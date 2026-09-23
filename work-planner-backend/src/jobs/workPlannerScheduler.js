/**
 * @fileoverview Scheduled cron jobs for Work Planner daily reminders.
 * - 10:00 AM Morning: Work Plan creation pending reminder
 * - 6:00 PM Evening: Day End submission pending reminder
 * Strictly checks work_planner portal access roles.
 * @module jobs/workPlannerScheduler
 */
const cron = require('node-cron');
const {
  WORK_PLANNER_TZ,
  WORK_PLAN_PENDING_CRON,
  DAY_END_PENDING_CRON,
  WORK_PLANNER_REMINDERS_ENABLED,
} = require('../config/env');
const { getModels } = require('../data/mongoRegistry');
const {
  getActiveUsersByWpRole,
  sendPendingWorkPlanMorningReminder,
  sendPendingDayEndEveningReminder,
} = require('../modules/workPlanner/workPlannerAutoNotification.service');
const { logger } = require('../utils/logger');

let started = false;

function getYmdInTz(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function zonedDateTimeToUtc(ymd, hms, timeZone) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [hh, mm, ss] = hms.split(':').map(Number);
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);

  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(utcMs))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value])
    );
    const gotMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const wantedMs = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);
    utcMs += wantedMs - gotMs;
  }

  return new Date(utcMs);
}

function dayBoundsInTz(date, timeZone) {
  const ymd = getYmdInTz(date, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextYmd = next.toISOString().slice(0, 10);
  return {
    ymd,
    start: zonedDateTimeToUtc(ymd, '00:00:00', timeZone),
    endExclusive: zonedDateTimeToUtc(nextYmd, '00:00:00', timeZone),
  };
}

/**
 * 10:00 AM Morning Job: Check for executives who have not created a work plan for today.
 */
async function runPendingWorkPlanCheck({ timeZone = WORK_PLANNER_TZ || 'Asia/Kolkata' } = {}) {
  try {
    const { ymd, start, endExclusive } = dayBoundsInTz(new Date(), timeZone);
    logger.info(`[workPlannerScheduler] Running 10 AM Work Plan Pending check for ${ymd} (tz: ${timeZone})`);

    const { WorkPlan } = getModels();

    // 1. Get all active executives strictly by portal access_roles
    const executives = await getActiveUsersByWpRole('executive');
    if (executives.length === 0) {
      logger.info('[workPlannerScheduler] No active Work Planner executives found.');
      return;
    }

    // 2. Query today's work plans
    const todayPlans = await WorkPlan.find({
      plan_date: { $gte: start, $lt: endExclusive },
      deletedAt: null,
    }).select('sales_user status').lean();

    const usersWithPlan = new Set(
      todayPlans.map((p) => String(p.sales_user)).filter(Boolean)
    );

    // 3. Find executives with no plan for today
    const pendingExecutives = executives.filter((e) => !usersWithPlan.has(String(e._id)));

    logger.info(
      `[workPlannerScheduler] Found ${pendingExecutives.length}/${executives.length} executives without Work Plan for ${ymd}`
    );

    // 4. Dispatch in-app notifications and emails
    await sendPendingWorkPlanMorningReminder(pendingExecutives, ymd, timeZone);
  } catch (err) {
    logger.error(`[workPlannerScheduler] Error in runPendingWorkPlanCheck: ${err.message}`);
  }
}

/**
 * 6:00 PM Evening Job: Check for executives whose today's work plan is still incomplete (Day End pending).
 */
async function runPendingDayEndCheck({ timeZone = WORK_PLANNER_TZ || 'Asia/Kolkata' } = {}) {
  try {
    const { ymd, start, endExclusive } = dayBoundsInTz(new Date(), timeZone);
    logger.info(`[workPlannerScheduler] Running 6 PM Day End Pending check for ${ymd} (tz: ${timeZone})`);

    const { WorkPlan, User } = getModels();

    // 1. Query today's work plans that are NOT completed
    const incompletePlans = await WorkPlan.find({
      plan_date: { $gte: start, $lt: endExclusive },
      status: { $ne: 'completed' },
      deletedAt: null,
    }).populate('sales_user', 'name email portals is_active').lean();

    // Filter plans where the sales_user is active and has work_planner executive role
    const pendingPlansWithUsers = [];
    for (const plan of incompletePlans) {
      const user = plan.sales_user;
      if (user && user.is_active !== false) {
        pendingPlansWithUsers.push({ user, plan });
      }
    }

    logger.info(
      `[workPlannerScheduler] Found ${pendingPlansWithUsers.length} incomplete work plans for ${ymd}`
    );

    // 2. Dispatch in-app notifications and emails
    await sendPendingDayEndEveningReminder(pendingPlansWithUsers, ymd, timeZone);
  } catch (err) {
    logger.error(`[workPlannerScheduler] Error in runPendingDayEndCheck: ${err.message}`);
  }
}

function startSchedulers() {
  if (started) return;
  started = true;

  const enabled = String(WORK_PLANNER_REMINDERS_ENABLED).toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('[workPlannerScheduler] Scheduled reminders disabled (WORK_PLANNER_REMINDERS_ENABLED=false)');
    return;
  }

  const timeZone = WORK_PLANNER_TZ || 'Asia/Kolkata';
  const morningCron = WORK_PLAN_PENDING_CRON || '0 10 * * *';
  const eveningCron = DAY_END_PENDING_CRON || '0 18 * * *';

  // 1. Morning 10 AM Scheduler
  if (cron.validate(morningCron)) {
    cron.schedule(
      morningCron,
      () => {
        runPendingWorkPlanCheck({ timeZone }).catch((err) => {
          logger.error(`[workPlannerScheduler] 10 AM morning check failed: ${err.message}`);
        });
      },
      { timezone: timeZone }
    );
    logger.info(`[workPlannerScheduler] Scheduled Morning 10 AM Pending Work Plan check at cron="${morningCron}" tz="${timeZone}"`);
  } else {
    logger.error(`[workPlannerScheduler] Invalid WORK_PLAN_PENDING_CRON="${morningCron}"`);
  }

  // 2. Evening 6 PM Scheduler
  if (cron.validate(eveningCron)) {
    cron.schedule(
      eveningCron,
      () => {
        runPendingDayEndCheck({ timeZone }).catch((err) => {
          logger.error(`[workPlannerScheduler] 6 PM evening check failed: ${err.message}`);
        });
      },
      { timezone: timeZone }
    );
    logger.info(`[workPlannerScheduler] Scheduled Evening 6 PM Pending Day End check at cron="${eveningCron}" tz="${timeZone}"`);
  } else {
    logger.error(`[workPlannerScheduler] Invalid DAY_END_PENDING_CRON="${eveningCron}"`);
  }
}

module.exports = {
  startSchedulers,
  runPendingWorkPlanCheck,
  runPendingDayEndCheck,
};
