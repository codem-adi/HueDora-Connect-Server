import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Client from './models/Client.js';
import ClientMaster from './models/ClientMaster.js';
import Campaign from './models/Campaign.js';
import Camp from './models/Camp.js';
import { CAMP_NAME_OPTIONS } from './config/campNames.js';
import { ROLES } from './config/constants.js';
import { captureSubmissionTracking } from './utils/reactionHelpers.js';

const clients = [
  { name: 'Intas', code: 'INTAS' },
  { name: 'Dr Reddy', code: 'DRREDDY' },
  { name: 'RK Meditech', code: 'RKMED' },
  { name: 'NCR', code: 'NCR' },
  { name: 'Aaadi Meditech', code: 'AAADI' },
  { name: 'MedRento', code: 'MEDRENTO' },
  { name: 'Zydus Pharma', code: 'ZYDUS' },
  { name: 'UNS', code: 'UNS' },
  { name: 'Sun Pharma', code: 'SUN' },
  { name: 'Diya Osteoporosis', code: 'DIYA' },
  { name: 'Abbott', code: 'ABBOTT' },
  { name: 'Cipla', code: 'CIPLA' },
  { name: 'Torrent Pharma', code: 'TORRENT' },
];

const clientMasterSeeds = [
  { clientCode: 'INTAS', programName: 'Viva BMD Camps', drugTherapyName: 'q', campName: 'BMD', campType: 'HCW + Device', coordinatorName: 'A', healthcareWorker: 'Technician', poAmount: 55000, campDuration: '4:00', spocName: 'A', spocNumber: '8787894030', requestTimeline: '5 Days Before', executedCampUnit: 3500, cancelledCampUnit: 3500, otUnit: 600, minimumPatientCovered: 10, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 0 },
  { clientCode: 'DRREDDY', programName: 'Ortreso', drugTherapyName: 'w', campName: 'Others', campType: 'Device Only', coordinatorName: 'B', healthcareWorker: 'Phlebotomist', poAmount: 90000, campDuration: '4:00', spocName: 'B', spocNumber: '9999999999', requestTimeline: '5 Days Before', executedCampUnit: 4400, cancelledCampUnit: 4400, otUnit: 600, minimumPatientCovered: 0, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 0 },
  { clientCode: 'RKMED', programName: 'BMD Camps', drugTherapyName: 'e', campName: 'Others', campType: 'HCW Only', coordinatorName: 'C', healthcareWorker: 'Phlebotomist', poAmount: 120000, campDuration: '4:00', spocName: 'C', spocNumber: '7676767667', requestTimeline: '5 Days Before', executedCampUnit: 3000, cancelledCampUnit: 3000, otUnit: 0, minimumPatientCovered: 15, minimumKmsCovered: 50, extPatientUnit: 120, kmsUnit: 4 },
  { clientCode: 'NCR', programName: 'BMD Camps', drugTherapyName: 'r', campName: 'Dieitician', campType: 'Rented', coordinatorName: 'D', healthcareWorker: 'Dietician', poAmount: 90000, campDuration: '4:00', spocName: 'D', spocNumber: '1212121211', requestTimeline: '5 Days Before', executedCampUnit: 3000, cancelledCampUnit: 3000, otUnit: 0, minimumPatientCovered: 0, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 0 },
  { clientCode: 'AAADI', programName: 'BMD Camps', drugTherapyName: 'y', campName: 'Dieitician', campType: 'HCW + Device', coordinatorName: 'A', healthcareWorker: 'Dietician', poAmount: 55000, campDuration: '4:00', spocName: 'A', spocNumber: '8787894030', requestTimeline: '5 Days Before', executedCampUnit: 3000, cancelledCampUnit: 3000, otUnit: 0, minimumPatientCovered: 0, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 0 },
  { clientCode: 'MEDRENTO', programName: 'Cachet India BMD Camps', drugTherapyName: 't', campName: 'Others', campType: 'Device Only', coordinatorName: 'B', healthcareWorker: 'Phlebotomist', poAmount: 55000, campDuration: '5:00', spocName: 'B', spocNumber: '9999999999', requestTimeline: '2 Days Before', executedCampUnit: 3500, cancelledCampUnit: 3500, otUnit: 0, minimumPatientCovered: 50, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 4 },
  { clientCode: 'ZYDUS', programName: 'BMD Camps', drugTherapyName: 'u', campName: 'Physio & Nuero', campType: 'HCW Only', coordinatorName: 'C', healthcareWorker: 'Technician', poAmount: 90000, campDuration: '6:00', spocName: 'C', spocNumber: '7676767667', requestTimeline: '2 Days Before', executedCampUnit: 3700, cancelledCampUnit: 3700, otUnit: 600, minimumPatientCovered: 10, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 0 },
  { clientCode: 'UNS', programName: 'BMD Camps', drugTherapyName: 'i', campName: 'Physio & Nuero', campType: 'Rented', coordinatorName: 'D', healthcareWorker: 'Technician', poAmount: 120000, campDuration: '6:00', spocName: 'D', spocNumber: '1212121211', requestTimeline: '2 Days Before', executedCampUnit: 3800, cancelledCampUnit: 3800, otUnit: 950, minimumPatientCovered: 0, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 3 },
  { clientCode: 'SUN', programName: 'Classic BMD Camps', drugTherapyName: 'p', campName: 'Uroflow', campType: 'HCW + Device', coordinatorName: 'A', healthcareWorker: 'Technician', poAmount: 90000, campDuration: '5:00', spocName: 'A', spocNumber: '8787894030', requestTimeline: '2 Days Before', executedCampUnit: 3700, cancelledCampUnit: 3700, otUnit: 600, minimumPatientCovered: 15, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 0 },
  { clientCode: 'DIYA', programName: 'BMD Camps', drugTherapyName: 'j', campName: 'Uroflow', campType: 'HCW + Device', coordinatorName: 'B', healthcareWorker: 'Technician', poAmount: 55000, campDuration: '4:00', spocName: 'B', spocNumber: '9999999999', requestTimeline: '2 Days Before', executedCampUnit: 3000, cancelledCampUnit: 3000, otUnit: 0, minimumPatientCovered: 0, minimumKmsCovered: 50, extPatientUnit: 0, kmsUnit: 0 },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/k_dashboard';
  await connectDB(uri);

  await Promise.all([
    User.deleteMany({}),
    Client.deleteMany({}),
    ClientMaster.deleteMany({}),
    Campaign.deleteMany({}),
    Camp.deleteMany({}),
  ]);

  const userSeeds = [
    { name: 'Super Admin', email: 'superadmin@kdashboard.com', password: 'admin123', role: ROLES.SUPER_ADMIN },
    { name: 'Camp Admin', email: 'admin@kdashboard.com', password: 'admin123', role: ROLES.ADMIN },
    { name: 'Ops Executive', email: 'ops@kdashboard.com', password: 'admin123', role: ROLES.OPERATIONS_EXECUTIVE },
    { name: 'Camp Reviewer', email: 'reviewer@kdashboard.com', password: 'admin123', role: ROLES.REVIEWER },
    { name: 'Read Only User', email: 'viewer@kdashboard.com', password: 'admin123', role: ROLES.READ_ONLY },
    { name: 'WhatsApp Bot', email: 'whatsapp-bot@kdashboard.com', password: 'admin123', role: ROLES.OPERATIONS_EXECUTIVE },
    { name: 'Email Bot', email: 'email-bot@kdashboard.com', password: 'admin123', role: ROLES.OPERATIONS_EXECUTIVE },
  ];
  const users = await Promise.all(userSeeds.map((seedUser) => User.create(seedUser)));

  const seededClients = await Client.insertMany(clients);
  const clientByCode = Object.fromEntries(seededClients.map((client) => [client.code, client]));

  await ClientMaster.insertMany(
    clientMasterSeeds.map((seedRow) => {
      const client = clientByCode[seedRow.clientCode];
      return {
        client: client._id,
        clientName: client.name,
        programName: seedRow.programName,
        drugTherapyName: seedRow.drugTherapyName,
        campName: seedRow.campName,
        campType: seedRow.campType,
        coordinatorName: seedRow.coordinatorName,
        healthcareWorker: seedRow.healthcareWorker,
        poAmount: seedRow.poAmount,
        campDuration: seedRow.campDuration,
        spocName: seedRow.spocName,
        spocNumber: seedRow.spocNumber,
        requestTimeline: seedRow.requestTimeline,
        executedCampUnit: seedRow.executedCampUnit,
        cancelledCampUnit: seedRow.cancelledCampUnit,
        otUnit: seedRow.otUnit,
        minimumPatientCovered: seedRow.minimumPatientCovered,
        minimumKmsCovered: seedRow.minimumKmsCovered,
        extPatientUnit: seedRow.extPatientUnit,
        kmsUnit: seedRow.kmsUnit,
        createdBy: users[1]._id,
        updatedBy: users[1]._id,
      };
    }),
  );

const divisions = ['Classic', 'Premium', 'Active'];

  const campaigns = [];
  for (const client of seededClients) {
    for (const division of divisions) {
      campaigns.push({
        name: division,
        division,
        client: client._id,
      });
    }
  }
  const seededCampaigns = await Campaign.insertMany(campaigns);

  const statuses = ['pending_review', 'approved', 'executed', 'cancelled', 'rescheduled', 'rejected'];
  const durations = [3, 4, 5, 6, 8];
  const states = ['Maharashtra', 'Gujarat', 'Karnataka', 'Delhi', 'Tamil Nadu'];
  const cities = ['Mumbai', 'Ahmedabad', 'Bengaluru', 'New Delhi', 'Chennai'];
  const monthCounters = {};

  const camps = Array.from({ length: 24 }, (_, i) => {
    const client = seededClients[i % seededClients.length];
    const clientCampaigns = seededCampaigns.filter(
      (item) => String(item.client) === String(client._id)
    );
    const campaign = clientCampaigns[i % clientCampaigns.length];
    const masterSeed = clientMasterSeeds.find((row) => row.clientCode === client.code);
    const campCampName = CAMP_NAME_OPTIONS[i % CAMP_NAME_OPTIONS.length];
    const campDivision = masterSeed?.programName || campaign.division;
    let status = statuses[i % statuses.length];
    const durationHours = durations[i % durations.length];
    const date = new Date();
    date.setDate(date.getDate() + (i - 18));
    const startHour = 9;
    const endHour = startHour + durationHours;
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yy}-${mm}`;
    monthCounters[monthKey] = (monthCounters[monthKey] || 0) + 1;

    if (i < 6) {
      status = 'approved';
      date.setDate(date.getDate() - 3);
    }
    if ([6, 7, 8, 9, 10].includes(i)) {
      status = 'pending_review';
    }

    const submittedAt = new Date();
    if (status === 'pending_review') {
      if (i === 6) {
        submittedAt.setDate(submittedAt.getDate() - 2);
        submittedAt.setHours(10, 0, 0, 0);
      } else if (i === 7) {
        submittedAt.setDate(submittedAt.getDate() - submittedAt.getDay());
        submittedAt.setHours(11, 0, 0, 0);
      } else if (i === 8) {
        const daysSinceSaturday = (submittedAt.getDay() + 1) % 7;
        submittedAt.setDate(submittedAt.getDate() - daysSinceSaturday);
        submittedAt.setHours(21, 0, 0, 0);
      } else if (i === 9) {
        submittedAt.setDate(submittedAt.getDate() - 1);
        submittedAt.setHours(22, 30, 0, 0);
      } else {
        submittedAt.setHours(14, 0, 0, 0);
      }
    } else {
      submittedAt.setDate(submittedAt.getDate() - (i % 5 + 2));
      submittedAt.setHours(11, 0, 0, 0);
    }

    const tracking = captureSubmissionTracking(submittedAt);

    return {
      campId: `${monthKey}-${String(monthCounters[monthKey]).padStart(4, '0')}`,
      client: client._id,
      clientName: client.name,
      campaign: campaign._id,
      campaignName: campCampName,
      campaignType: campDivision,
      doctorName: `Dr. Sample ${i + 1}`,
      doctorCode: `DOC${100 + i}`,
      hospitalName: `${cities[i % cities.length]} General Hospital`,
      city: cities[i % cities.length],
      state: states[i % states.length],
      campDate: date,
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String(endHour).padStart(2, '0')}:00`,
      durationHours,
      expectedPatients: 50 + (i * 3),
      actualPatients: status === 'executed' ? 45 + (i * 2) : 0,
      fieldPersonName: `Field Rep ${i + 1}`,
      technicianName: `Tech ${i + 1}`,
      source: ['email', 'whatsapp', 'excel'][i % 3],
      status,
      createdBy: users[1]._id,
      approvedBy: ['approved', 'executed', 'cancelled', 'rescheduled'].includes(status)
        ? users[1]._id
        : null,
      executedBy: status === 'executed' ? users[2]._id : null,
      executedAt: status === 'executed' ? new Date() : null,
      ...tracking,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    };
  });

  await Camp.insertMany(camps);

  console.log('Seed complete');
  console.log('Login: admin@kdashboard.com / admin123');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
