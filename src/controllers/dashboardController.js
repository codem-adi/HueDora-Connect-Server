import Camp from '../models/Camp.js';
import Client from '../models/Client.js';
import Campaign from '../models/Campaign.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildCampFilter, isCampOverdue } from '../utils/campHelpers.js';
import { getReactionAlert } from '../utils/reactionHelpers.js';

const STATUS_LABELS = [
  'pending_review',
  'approved',
  'executed',
  'rejected',
  'cancelled',
];

export const getDashboardStats = asyncHandler(async (req, res) => {
  const baseFilter = buildCampFilter(req.query);

  const campsInRange = await Camp.find(baseFilter).select(
    'status client clientName campaign campaignName campaignType campDate submittedAt submittedOffHours submittedWeekendAttention createdAt'
  );

  const byStatus = Object.fromEntries(STATUS_LABELS.map((status) => [status, 0]));

  campsInRange.forEach((camp) => {
    byStatus[camp.status] = (byStatus[camp.status] || 0) + 1;
  });

  const approvedOverdue = await Camp.find({ ...baseFilter, status: 'approved' });
  const overdueNotExecuted = approvedOverdue.filter(isCampOverdue).length;

  const pendingForAlerts = campsInRange.filter((camp) => camp.status === 'pending_review');
  let reactionRequired = 0;
  let offHoursPending = 0;
  let weekendAttentionPending = 0;

  pendingForAlerts.forEach((camp) => {
    const alert = getReactionAlert(camp);
    if (alert.reactionRequired) reactionRequired += 1;
    if (alert.offHoursSubmission) offHoursPending += 1;
    if (alert.weekendAttention) weekendAttentionPending += 1;
  });

  const [brandDocs, campaignDocs] = await Promise.all([
    Client.find({ deletedAt: null }).select('name code').sort({ name: 1 }),
    Campaign.find({ deletedAt: null }).populate('client', 'name').sort({ division: 1 }),
  ]);

  const brandBreakdown = brandDocs
    .map((brand) => ({
      id: brand._id,
      label: brand.name,
      value: campsInRange.filter((camp) => String(camp.client) === String(brand._id)).length,
    }))
    .filter((item) => item.value > 0);

  const campaignBreakdown = campaignDocs
    .map((item) => ({
      id: item._id,
      label: `${item.client?.name || 'Brand'} — ${item.division || item.name}`,
      division: item.division || item.name,
      value: campsInRange.filter(
        (camp) => String(camp.campaign) === String(item._id) || camp.campaignName === item.name
      ).length,
    }))
    .filter((entry) => entry.value > 0);

  const byClient = await Camp.aggregate([
    { $match: baseFilter },
    { $group: { _id: '$clientName', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const byState = await Camp.aggregate([
    { $match: { ...baseFilter, state: { $ne: '' } } },
    { $group: { _id: '$state', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const byCampaignType = await Camp.aggregate([
    { $match: baseFilter },
    { $group: { _id: '$campaignType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const monthlyTrends = await Camp.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: {
          year: { $year: '$campDate' },
          month: { $month: '$campDate' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.json({
    dateRange: {
      from: req.query.dateFrom || null,
      to: req.query.dateTo || null,
    },
    hierarchy: {
      brands: { total: brandDocs.length, items: brandBreakdown },
      campaigns: { total: campaignDocs.length, items: campaignBreakdown },
    },
    camps: {
      total: campsInRange.length,
      byStatus: {
        ...byStatus,
        overdue_not_executed: overdueNotExecuted,
      },
      alerts: {
        reaction_required: reactionRequired,
        off_hours_pending: offHoursPending,
        weekend_attention_pending: weekendAttentionPending,
      },
    },
    charts: {
      byClient: byClient.map((item) => ({ label: item._id, value: item.count })),
      byState: byState.map((item) => ({ label: item._id, value: item.count })),
      byCampaignType: byCampaignType.map((item) => ({ label: item._id, value: item.count })),
      monthlyTrends: monthlyTrends.map((item) => ({
        label: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        value: item.count,
      })),
    },
  });
});

export const listClients = asyncHandler(async (req, res) => {
  const clients = await Client.find({ deletedAt: null }).sort({ name: 1 });
  res.json({ data: clients });
});
