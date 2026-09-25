/**
 * @fileoverview Comprehensive Auto-Notification & Scheduled Reminder service for Work Planner.
 * Strictly uses work_planner portal access roles (not parent roles or department).
 * @module modules/workPlanner/workPlannerAutoNotification.service
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const emailHelper = require('../messages/helpers/email.helper');
const { logger } = require('../../utils/logger');
const {
  NOTIFICATION_SERVICE_URL,
  JWT_SECRET,
  FRONTEND_URL,
} = require('../../config/env');

function getServiceToken() {
  return jwt.sign(
    {
      sub: 'work-planner-service',
      name: 'Work Planner Service',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Normalizes role string to lowercase trimmed token.
 */
function normalizeRole(r) {
  return String(r || '').trim().toLowerCase();
}

/**
 * Extracts ONLY portal access_roles for 'work_planner' (ignoring parent roles & department).
 */
function getWorkPlannerPortalRoles(user) {
  if (!user) return [];
  const portals = Array.isArray(user.portals) ? user.portals : [];
  const wpPortal = portals.find(
    (p) => p && normalizeRole(p.portal_code || p.portal) === 'work_planner'
  );
  if (!wpPortal || !Array.isArray(wpPortal.access_roles)) return [];
  return wpPortal.access_roles.map(normalizeRole).filter(Boolean);
}

function isWpExecutive(user) {
  const roles = getWorkPlannerPortalRoles(user);
  return roles.some((r) => ['executive', 'sales'].includes(r));
}

function isWpManager(user) {
  const roles = getWorkPlannerPortalRoles(user);
  return roles.includes('manager');
}

function isWpAdmin(user) {
  const roles = getWorkPlannerPortalRoles(user);
  return roles.includes('admin');
}

/**
 * Fetches all active users possessing a given role in work_planner portal access_roles.
 */
async function getActiveUsersByWpRole(roleFilter = 'all') {
  try {
    const { User } = getModels();
    const users = await User.find({ is_active: { $ne: false } }).lean();

    return users.filter((u) => {
      const roles = getWorkPlannerPortalRoles(u);
      if (roles.length === 0) return false;
      if (roleFilter === 'all') return true;
      if (roleFilter === 'executive') return roles.some((r) => ['executive', 'sales'].includes(r));
      if (roleFilter === 'manager') return roles.includes('manager') || roles.includes('admin');
      if (roleFilter === 'admin') return roles.includes('admin');
      return false;
    });
  } catch (err) {
    logger.error(`[AutoNotification] Failed to query active users for role ${roleFilter}: ${err.message}`);
    return [];
  }
}

/**
 * Gets all active managers & admins for work_planner portal.
 */
async function getWorkPlannerManagers() {
  return getActiveUsersByWpRole('manager');
}

/**
 * Sends in-app notification (SSE / WebPush via notification-service + MongoDB fallback).
 */
async function sendInAppNotification(userId, { title, message, type = 'info', entity_type = 'work_planner', entity_id = null }) {
  if (!userId) return null;
  const strUserId = String(userId);

  // 1. Direct MongoDB write so it is immediately accessible
  let createdDoc = null;
  try {
    const { Notification } = getModels();
    const doc = await Notification.create({
      user: strUserId,
      title,
      message,
      type,
      module: 'work_planner',
      entity_type,
      entity_id: entity_id ? String(entity_id) : undefined,
      is_read: false,
    });
    createdDoc = toPlain(doc.toObject());
  } catch (err) {
    logger.warn(`[AutoNotification] Local notification write failed: ${err.message}`);
  }

  // 2. Broadcast via notification-service for real-time SSE & Web Push
  if (NOTIFICATION_SERVICE_URL) {
    try {
      const url = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`;
      await axios.post(
        url,
        {
          userId: strUserId,
          payload: {
            title,
            message,
            type,
            module: 'work_planner',
            entity_type,
            entity_id: entity_id ? String(entity_id) : undefined,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${getServiceToken()}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
    } catch (pushErr) {
      // Best-effort: do not throw
    }
  }

  return createdDoc;
}

/**
 * Resolves all stakeholders for a given plan / sales user:
 * - Executive user
 * - Direct Reporting Manager
 * - Portal Managers
 * - Configured CC Emails
 */
async function resolveStakeholders(salesUserId, planDoc = null) {
  const { User, UserWorkPlannerSettings, WorkPlannerReportingEdge } = getModels();
  const salesUser = await User.findOne({ _id: salesUserId, is_active: { $ne: false } }).lean();
  const allManagers = await getWorkPlannerManagers();

  let directManager = null;
  let settingsCcEmails = [];

  // Check UserWorkPlannerSettings
  const settings = await UserWorkPlannerSettings.findOne({ user: salesUserId }).lean();
  if (settings) {
    if (settings.assigned_manager) {
      directManager = allManagers.find(
        (m) => String(m._id) === String(settings.assigned_manager)
      );
      if (!directManager) {
        directManager = await User.findOne({ _id: settings.assigned_manager, is_active: { $ne: false } }).lean();
      }
    }

    // Match plan type settings if available
    const planType = planDoc?.plan_type || 'Visits';
    const ptSetting = Array.isArray(settings.plan_type_settings)
      ? settings.plan_type_settings.find((p) => p.plan_type === planType)
      : null;

    if (ptSetting?.assigned_manager) {
      const ptMgr = allManagers.find((m) => String(m._id) === String(ptSetting.assigned_manager));
      if (ptMgr) directManager = ptMgr;
    }

    if (Array.isArray(ptSetting?.cc_emails) && ptSetting.cc_emails.length > 0) {
      settingsCcEmails = ptSetting.cc_emails;
    } else if (Array.isArray(settings.cc_emails) && settings.cc_emails.length > 0) {
      settingsCcEmails = settings.cc_emails;
    }
  }

  // Check WorkPlannerReportingEdge if no direct manager from settings
  if (!directManager) {
    const edge = await WorkPlannerReportingEdge.findOne({
      subordinate: salesUserId,
      is_active: { $ne: false },
    }).populate('manager').lean();
    if (edge?.manager) {
      directManager = edge.manager;
    }
  }

  // Check discussed manager from plan
  if (!directManager && planDoc?.discussed_manager_id) {
    directManager = allManagers.find(
      (m) => String(m._id) === String(planDoc.discussed_manager_id)
    );
  }

  // Fallback direct manager to first portal manager
  if (!directManager && allManagers.length > 0) {
    directManager = allManagers[0];
  }

  // Build manager emails and CC list
  const managerEmails = allManagers.map((m) => m.email).filter(Boolean);
  const primaryRecipientEmail = directManager?.email || managerEmails[0] || '';

  const ccSet = new Set(
    settingsCcEmails
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => e && e !== primaryRecipientEmail.toLowerCase())
  );

  // Add other managers to CC
  for (const m of allManagers) {
    if (m.email && m.email.toLowerCase() !== primaryRecipientEmail.toLowerCase()) {
      ccSet.add(m.email.toLowerCase());
    }
  }

  // Distinct in-app user IDs
  const inAppUserIds = new Set();
  if (salesUserId) inAppUserIds.add(String(salesUserId));
  if (directManager?._id) inAppUserIds.add(String(directManager._id));
  for (const m of allManagers) {
    if (m._id) inAppUserIds.add(String(m._id));
  }

  return {
    salesUser,
    directManager,
    allManagers,
    primaryRecipientEmail,
    ccList: Array.from(ccSet),
    inAppUserIds: Array.from(inAppUserIds),
  };
}

function formatDate(d) {
  if (!d) return 'N/A';
  try {
    return new Date(d).toISOString().split('T')[0];
  } catch {
    return String(d);
  }
}

function formatTime(d) {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return String(d);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderVisitsTable(visitsList) {
  if (!Array.isArray(visitsList) || visitsList.length === 0) {
    return '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No visits recorded for this plan.</p>';
  }
  const rows = visitsList
    .map((v, i) => {
      const party =
        (v.party && typeof v.party === 'object' ? v.party.party_name : null) ||
        v.party_name ||
        v.contact_person ||
        'N/A';
      const contact =
        v.contact_person ||
        (v.party && typeof v.party === 'object' ? v.party.contact_person : '') ||
        '';
      const purpose = v.purpose || 'General';
      const status = (v.status || 'pending').toLowerCase();
      const time = v.planned_start_time
        ? `${formatTime(v.planned_start_time)}${v.planned_end_time ? ' - ' + formatTime(v.planned_end_time) : ''}`
        : '—';

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'in_progress' || status === 'checked_in') {
        statusBadgeStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
      } else if (status === 'created' || status === 'pending') {
        statusBadgeStyle = 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
      } else if (['cancelled', 'skipped'].includes(status)) {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      let remarksHtml = '—';
      if (status === 'completed') {
        const out = v.outcome || v.notes || '';
        const outHtml = out ? `<div style="color: #15803d; font-weight: 500; margin-bottom: 6px;">${escapeHtml(out)}</div>` : '';

        const hasChecklist = [
          v.meeting_with_doctor,
          v.meeting_with_purchase,
          v.meeting_with_finance,
          v.meeting_with_engineer,
          v.new_product_introduced,
          v.order_received,
        ].some((val) => val !== undefined && val !== null);

        let checklistHtml = '';
        if (hasChecklist) {
          const renderTag = (label, val) => {
            const isYes = Boolean(val);
            const style = isYes
              ? 'background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0;'
              : 'background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;';
            return `<span style="display: inline-block; padding: 2px 6px; margin: 2px 4px 2px 0; border-radius: 4px; font-size: 10px; font-weight: 600; ${style}">${label}: ${isYes ? '✓ Yes' : '✗ No'}</span>`;
          };

          checklistHtml = `
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px;">Checklist:</div>
              <div>
                ${renderTag('Doctor', v.meeting_with_doctor)}
                ${renderTag('Purchase', v.meeting_with_purchase)}
                ${renderTag('Finance', v.meeting_with_finance)}
                ${renderTag('Engineer', v.meeting_with_engineer)}
                ${renderTag('New Product', v.new_product_introduced)}
                ${renderTag('Order', v.order_received)}
              </div>
            </div>
          `;
        }
        remarksHtml = outHtml || checklistHtml ? `${outHtml}${checklistHtml}` : '—';
      } else if (status === 'in_progress') {
        const inp = v.in_progress_remarks || v.notes || '';
        remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${escapeHtml(inp)}</span></div>` : '—';
      } else if (status === 'pending' || status === 'created') {
        const pnd = v.pending_remarks || v.notes || '';
        remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending:</span> <span style="color: #334155;">${escapeHtml(pnd)}</span></div>` : '—';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
            <div style="font-weight: 600;">${i + 1}. ${escapeHtml(party)}</div>
            ${contact ? `<div style="font-size: 11px; color: #64748b;">Contact: ${escapeHtml(contact)}</div>` : ''}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
            ${escapeHtml(purpose)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; white-space: nowrap;">
            ${time}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
              ${formattedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
            ${remarksHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Client / Party</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Purpose</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Time</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Status</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Outcome / Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderTasksTable(taskList) {
  if (!Array.isArray(taskList) || taskList.length === 0) {
    return '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No tasks recorded for this plan.</p>';
  }
  const rows = taskList
    .map((t, i) => {
      const title = t.title || 'Task #' + (i + 1);
      const desc = t.description || '—';
      const status = (t.status || 'pending').toLowerCase();
      const time = t.planned_start_time
        ? `${formatTime(t.planned_start_time)}${t.planned_end_time ? ' - ' + formatTime(t.planned_end_time) : ''}`
        : '—';

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'in_progress') {
        statusBadgeStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
      } else if (status === 'created' || status === 'pending') {
        statusBadgeStyle = 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
      } else if (status === 'cancelled') {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      let remarksHtml = '—';
      if (status === 'completed') {
        const out = t.completion_remarks || t.outcome || '';
        remarksHtml = out ? `<div style="color: #15803d; font-weight: 500;">${escapeHtml(out)}</div>` : '—';
      } else if (status === 'in_progress') {
        const inp = t.in_progress_remarks || '';
        remarksHtml = inp ? `<div><span style="color: #b45309; font-weight: 700; font-size: 11px; text-transform: uppercase;">In Progress:</span> <span style="color: #334155;">${escapeHtml(inp)}</span></div>` : '—';
      } else if (status === 'pending' || status === 'created') {
        const pnd = t.pending_remarks || '';
        remarksHtml = pnd ? `<div><span style="color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase;">Pending:</span> <span style="color: #334155;">${escapeHtml(pnd)}</span></div>` : '—';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600; width: 25%;">
            ${i + 1}. ${escapeHtml(title)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 35%;">
            ${escapeHtml(desc)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; white-space: nowrap; width: 15%;">
            ${time}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; width: 10%;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
              ${formattedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 15%;">
            ${remarksHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Task Title</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Description</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Time</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Status</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * 1. WORK PLAN CREATED AUTO NOTIFICATION
 */
async function notifyWorkPlanCreated({ planId, actorUser, creationMailData = {} }) {
  try {
    const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const { salesUser, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const planDateStr = formatDate(plan.plan_date);
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'User';

    // In-App Notifications
    const isSelf = String(actorUser?._id || actorUser?.id) === String(salesUserId);
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        if (!isSelf) {
          await sendInAppNotification(uid, {
            title: 'New Work Plan Assigned',
            message: `${actorName} created a new Work Plan for you for ${planDateStr} (${plan.plan_type || 'Visits'}).`,
            type: 'info',
            entity_type: 'work_plan',
            entity_id: plan._id,
          });
        }
      } else {
        await sendInAppNotification(uid, {
          title: `New Work Plan: ${executiveName}`,
          message: `${executiveName} submitted a ${plan.plan_type || 'Visits'} plan for ${planDateStr}${plan.location ? ' in ' + plan.location : ''}.`,
          type: 'info',
          entity_type: 'work_plan',
          entity_id: plan._id,
        });
      }
    }

    // Load related items
    const [visits, workItems] = await Promise.all([
      WorkPlanVisit.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanWork.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
    ]);

    const explicitTo = creationMailData.to_email || creationMailData.toEmail;
    const recipient = typeof explicitTo === 'string' ? explicitTo.trim() : '';
    if (!recipient) {
      logger.info(`[AutoNotification] In-app work plan notice sent for ${planId}; no mail because the client did not set a recipient`);
      return;
    }

    const providedCreationCc = creationMailData.cc_emails !== undefined
      ? creationMailData.cc_emails
      : creationMailData.ccEmails;
    // CC only what the client sent. Do not fill in portal admins or managers.
    const mailCc = Array.isArray(providedCreationCc)
      ? providedCreationCc.map((e) => String(e).trim()).filter(Boolean)
      : [];

    const fromAddress = salesUser?.email ? `${executiveName} <${salesUser.email}>` : `${actorName} <${actorUser.email}>`;
    const visitsTableHtml = renderVisitsTable(visits);
    const tasksTableHtml = renderTasksTable(workItems);
    const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const workPlanUrl = baseUrl ? `${baseUrl}/work-plans` : '';

    const subject = creationMailData.subject?.trim() || `New Work Plan Created — ${executiveName} (${planDateStr})`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">New Work Plan Submitted</h2>
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Work plan scheduled for <strong>${planDateStr}</strong></p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Executive:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(executiveName)} (${escapeHtml(salesUser?.email || '')})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Plan Type:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(plan.plan_type || 'Visits')}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Location:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.location || 'N/A')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>General Remarks:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.remarks || 'None')}</td>
            </tr>
          </table>

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 18px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Planned Visits (${visits.length})
          </h3>
          ${visitsTableHtml}

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Planned Tasks / Work Items (${workItems.length})
          </h3>
          ${tasksTableHtml}

          ${workPlanUrl ? `
            <div style="margin-top: 24px; text-align: center;">
              <a href="${workPlanUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                View Plan in OPMS Portal
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    await emailHelper.sendEmail(
      recipient,
      subject,
      '',
      emailHtml,
      [],
      mailCc,
      fromAddress
    );
    logger.info(`[AutoNotification] Sent Work Plan creation email to ${recipient} (CC: ${mailCc.join(', ')})`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch work plan creation notification: ${err.message}`);
  }
}

/**
 * 2. VISIT CREATED AUTO NOTIFICATION
 */
async function notifyVisitCreated({ visit, planDoc = null, actorUser = null }) {
  try {
    if (!visit) return;
    const { WorkPlan, Party } = getModels();
    let plan = planDoc;
    if (!plan && visit.work_plan) {
      plan = await WorkPlan.findOne({ _id: visit.work_plan, deletedAt: null }).lean();
    }

    const salesUserId = visit.sales_user || plan?.sales_user;
    const { salesUser, directManager, allManagers, primaryRecipientEmail, ccList, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const partyName = visit.party_name || (visit.party && typeof visit.party === 'object' ? visit.party.party_name : 'New Party');
    const planDateStr = formatDate(visit.plan_date || plan?.plan_date || new Date());
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const isSelf = String(actorUser?._id || actorUser?.id) === String(salesUserId);

    // In-App Notifications
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        if (!isSelf) {
          await sendInAppNotification(uid, {
            title: `New Visit Added: ${partyName}`,
            message: `${actorName} scheduled a visit to "${partyName}" for you on ${planDateStr}.`,
            type: 'info',
            entity_type: 'visit',
            entity_id: visit._id,
          });
        }
      } else {
        await sendInAppNotification(uid, {
          title: `New Visit: ${executiveName} → ${partyName}`,
          message: `${executiveName} scheduled a visit to "${partyName}" on ${planDateStr} (${visit.purpose || 'General'}).`,
          type: 'info',
          entity_type: 'visit',
          entity_id: visit._id,
        });
      }
    }

    logger.info(`[AutoNotification] Dispatched in-app notifications for visit created: ${partyName}`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch visit created notification: ${err.message}`);
  }
}

/**
 * 3. WORK TASK CREATED AUTO NOTIFICATION
 */
async function notifyTaskCreated({ task, planDoc = null, actorUser = null }) {
  try {
    if (!task) return;
    const { WorkPlan } = getModels();
    let plan = planDoc;
    if (!plan && task.work_plan) {
      plan = await WorkPlan.findOne({ _id: task.work_plan, deletedAt: null }).lean();
    }

    const salesUserId = task.sales_user || plan?.sales_user;
    const { salesUser, directManager, allManagers, primaryRecipientEmail, ccList, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const planDateStr = formatDate(task.plan_date || plan?.plan_date || new Date());
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';
    const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Manager';
    const isSelf = String(actorUser?._id || actorUser?.id) === String(salesUserId);

    // In-App Notifications
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        if (!isSelf) {
          await sendInAppNotification(uid, {
            title: `New Task Assigned: "${task.title}"`,
            message: `${actorName} assigned task "${task.title}" to you for ${planDateStr}.`,
            type: 'info',
            entity_type: 'task',
            entity_id: task._id,
          });
        }
      } else {
        await sendInAppNotification(uid, {
          title: `New Task: ${executiveName} → "${task.title}"`,
          message: `${executiveName} added work task "${task.title}" on ${planDateStr}.`,
          type: 'info',
          entity_type: 'task',
          entity_id: task._id,
        });
      }
    }

    logger.info(`[AutoNotification] Dispatched in-app notifications for task created: "${task.title}"`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch task created notification: ${err.message}`);
  }
}

/**
 * 4. DAY END CREATED / WORK PLAN COMPLETED AUTO NOTIFICATION
 */
async function notifyDayEndCompleted({ planId, actorUser, dayEndData = null }) {
  try {
    const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) return;

    const salesUserId = plan.sales_user;
    const { salesUser, directManager, allManagers, primaryRecipientEmail, ccList, inAppUserIds } =
      await resolveStakeholders(salesUserId, plan);

    const [visits, workItems, expenses] = await Promise.all([
      WorkPlanVisit.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanWork.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanExpense.find({ work_plan: planId, deletedAt: null }).select('amount').lean(),
    ]);

    const expensesTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const planDateStr = formatDate(plan.plan_date);
    const executiveName = salesUser?.name || salesUser?.email?.split('@')[0] || 'Executive';

    // In-App Notifications
    for (const uid of inAppUserIds) {
      if (String(uid) === String(salesUserId)) {
        await sendInAppNotification(uid, {
          title: 'Day End Submitted',
          message: `Your Day End report for ${planDateStr} has been submitted successfully (${visits.length} visits, ${workItems.length} tasks).`,
          type: 'success',
          entity_type: 'day_end',
          entity_id: plan._id,
        });
      } else {
        await sendInAppNotification(uid, {
          title: `Day End Submitted: ${executiveName}`,
          message: `${executiveName} submitted Day End report for ${planDateStr} with ${visits.length} visits, ${workItems.length} tasks, and ₹${expensesTotal.toLocaleString('en-IN')} expenses.`,
          type: 'info',
          entity_type: 'day_end',
          entity_id: plan._id,
        });
      }
    }

    // Email Notification
    const recipient = dayEndData?.to_email || primaryRecipientEmail;
    if (!recipient) return;

    const providedDayEndCc = dayEndData?.cc_emails !== undefined
      ? dayEndData.cc_emails
      : dayEndData?.ccEmails;
    const mailCc = Array.isArray(providedDayEndCc)
      ? providedDayEndCc.map((e) => String(e).trim()).filter(Boolean)
      : ccList;

    const fromAddress = salesUser?.email ? `${executiveName} <${salesUser.email}>` : null;
    const visitsTableHtml = renderVisitsTable(visits);
    const tasksTableHtml = renderTasksTable(workItems);
    const baseUrl = (FRONTEND_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const workPlanUrl = baseUrl ? `${baseUrl}/work-plans` : '';

    const subject = dayEndData?.subject?.trim() || `Day End Report — ${executiveName} (${planDateStr})`;

    const emailHtml = dayEndData?.body_html || `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Day End Report Completed</h2>
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Work Summary for <strong>${planDateStr}</strong></p>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;"><strong>Executive:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(executiveName)} (${escapeHtml(salesUser?.email || '')})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Plan Type:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;"><span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(plan.plan_type || 'Visits')}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Location:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.location || 'N/A')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Expenses Total:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">₹${expensesTotal.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Remarks:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(plan.remarks || 'None')}</td>
            </tr>
          </table>

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 18px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Visits & Outcome Summary (${visits.length})
          </h3>
          ${visitsTableHtml}

          <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
            Work Tasks Summary (${workItems.length})
          </h3>
          ${tasksTableHtml}

          ${workPlanUrl ? `
            <div style="margin-top: 24px; text-align: center;">
              <a href="${workPlanUrl}" style="background-color: #059669; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                View Completed Plan in Portal
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    await emailHelper.sendEmail(
      recipient,
      subject,
      '',
      emailHtml,
      [],
      mailCc,
      fromAddress
    );
    logger.info(`[AutoNotification] Sent Day End completion email to ${recipient} (CC: ${mailCc.join(', ')})`);
  } catch (err) {
    logger.error(`[AutoNotification] Failed to dispatch Day End completion notification: ${err.message}`);
  }
}

/**
 * 5. MORNING 10:00 AM PENDING WORK PLAN REMINDER DISPATCHER
 */
async function sendPendingWorkPlanMorningReminder(pendingUsers, dateStr, timeZone) {
  try {
    if (!Array.isArray(pendingUsers) || pendingUsers.length === 0) {
      logger.info(`[AutoNotification] Morning 10 AM reminder: No pending work plans for ${dateStr}.`);
      return;
    }

    logger.info(`[AutoNotification] Morning 10 AM reminder: Sending alerts for ${pendingUsers.length} pending executives.`);

    // Group pending users by direct manager for manager digest
    const managerDigestMap = new Map();

    for (const exec of pendingUsers) {
      const execName = exec.name || exec.email.split('@')[0];
      const { directManager, allManagers, ccList } = await resolveStakeholders(exec._id);

      // In-App Notification to Executive
      await sendInAppNotification(exec._id, {
        title: 'Morning Reminder: Work Plan Pending',
        message: `You have not created your Work Plan for today (${dateStr}). Please plan and submit your visits & tasks.`,
        type: 'warning',
        entity_type: 'work_plan_reminder',
      });

      // Individual Email to Executive (with CC to Manager)
      if (exec.email) {
        const mgrCc = directManager?.email ? [directManager.email] : [];
        const subject = `Morning Reminder: Work Plan Pending for Today (${dateStr})`;
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #d97706; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Work Plan Creation Pending</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.95;">Morning 10:00 AM Alert • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(execName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                This is a reminder that your daily Work Plan for today, <strong>${dateStr}</strong>, has not been submitted yet.
              </p>
              <p style="font-size: 13px; color: #334155;">
                Please log in to the Work Planner portal or mobile app to submit your scheduled visits and tasks.
              </p>
              <div style="margin: 24px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #d97706; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Create Work Plan Now
                </a>
              </div>
            </div>
          </div>
        `;

        await emailHelper.sendEmail(
          exec.email,
          subject,
          '',
          emailHtml,
          [],
          mgrCc
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 10 AM email to ${exec.email}: ${err.message}`);
        });
      }

      // Add to manager digest bucket
      const targetMgr = directManager || (allManagers.length > 0 ? allManagers[0] : null);
      if (targetMgr) {
        const mgrId = String(targetMgr._id);
        if (!managerDigestMap.has(mgrId)) {
          managerDigestMap.set(mgrId, { manager: targetMgr, pendingExecs: [] });
        }
        managerDigestMap.get(mgrId).pendingExecs.push(exec);
      }
    }

    // Send Manager Digests
    for (const [mgrId, data] of managerDigestMap.entries()) {
      const { manager, pendingExecs } = data;
      const mgrName = manager.name || manager.email.split('@')[0];

      // In-App Notification to Manager
      await sendInAppNotification(mgrId, {
        title: `Work Plan Pending Digest (${dateStr})`,
        message: `${pendingExecs.length} team member(s) have not created their work plan for today: ${pendingExecs.map((e) => e.name || e.email).join(', ')}.`,
        type: 'warning',
        entity_type: 'manager_digest',
      });

      // Digest Email to Manager
      if (manager.email) {
        const execRows = pendingExecs
          .map(
            (e, i) => `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 600;">${i + 1}. ${escapeHtml(e.name || e.email)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">${escapeHtml(e.email)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: center;"><span style="color: #b45309; font-weight: 700; font-size: 11px; background: #fef3c7; padding: 2px 8px; border-radius: 9999px;">Pending</span></td>
            </tr>
          `
          )
          .join('');

        const digestHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #1e293b; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Team Work Plan Pending Digest</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.85;">Morning 10:00 AM Check • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(mgrName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                The following <strong>${pendingExecs.length}</strong> team member(s) have not yet created their Work Plan for today (<strong>${dateStr}</strong>):
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Executive</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Email</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: center; font-size: 12px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${execRows}
                </tbody>
              </table>
              <div style="margin: 20px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #1e293b; color: #ffffff; padding: 9px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Open Work Planner Management
                </a>
              </div>
            </div>
          </div>
        `;

        await emailHelper.sendEmail(
          manager.email,
          `Team Work Plan Pending Digest — ${dateStr} (${pendingExecs.length} Pending)`,
          '',
          digestHtml
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 10 AM digest to manager ${manager.email}: ${err.message}`);
        });
      }
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in sendPendingWorkPlanMorningReminder: ${err.message}`);
  }
}

/**
 * 6. EVENING 6:00 PM PENDING DAY END REMINDER DISPATCHER
 */
async function sendPendingDayEndEveningReminder(pendingPlansWithUsers, dateStr, timeZone) {
  try {
    if (!Array.isArray(pendingPlansWithUsers) || pendingPlansWithUsers.length === 0) {
      logger.info(`[AutoNotification] Evening 6 PM reminder: No pending Day End reports for ${dateStr}.`);
      return;
    }

    logger.info(`[AutoNotification] Evening 6 PM reminder: Sending alerts for ${pendingPlansWithUsers.length} pending Day End reports.`);

    const managerDigestMap = new Map();

    for (const item of pendingPlansWithUsers) {
      const exec = item.user;
      const plan = item.plan;
      const execName = exec.name || exec.email.split('@')[0];
      const { directManager, allManagers } = await resolveStakeholders(exec._id, plan);

      // In-App Notification to Executive
      await sendInAppNotification(exec._id, {
        title: 'Evening Reminder: Day End Report Pending',
        message: `Your Day End report for today (${dateStr}) is pending submission. Please review and complete your visits/tasks and submit Day End.`,
        type: 'warning',
        entity_type: 'day_end_reminder',
        entity_id: plan?._id,
      });

      // Individual Email to Executive (with CC to Manager)
      if (exec.email) {
        const mgrCc = directManager?.email ? [directManager.email] : [];
        const subject = `Evening Reminder: Day End Report Pending for Today (${dateStr})`;
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #0284c7; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Day End Submission Pending</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.95;">Evening 6:00 PM Alert • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(execName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                This is an evening reminder to complete your visits/tasks and submit your <strong>Day End Report</strong> for today (<strong>${dateStr}</strong>).
              </p>
              <p style="font-size: 13px; color: #334155;">
                Submitting your Day End report compiles your visit outcomes, meeting checklists, and day tasks for your reporting manager.
              </p>
              <div style="margin: 24px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #0284c7; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Submit Day End Report
                </a>
              </div>
            </div>
          </div>
        `;

        await emailHelper.sendEmail(
          exec.email,
          subject,
          '',
          emailHtml,
          [],
          mgrCc
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 6 PM email to ${exec.email}: ${err.message}`);
        });
      }

      // Add to manager digest bucket
      const targetMgr = directManager || (allManagers.length > 0 ? allManagers[0] : null);
      if (targetMgr) {
        const mgrId = String(targetMgr._id);
        if (!managerDigestMap.has(mgrId)) {
          managerDigestMap.set(mgrId, { manager: targetMgr, pendingItems: [] });
        }
        managerDigestMap.get(mgrId).pendingItems.push({ user: exec, plan });
      }
    }

    // Send Manager Digests
    for (const [mgrId, data] of managerDigestMap.entries()) {
      const { manager, pendingItems } = data;
      const mgrName = manager.name || manager.email.split('@')[0];

      // In-App Notification to Manager
      await sendInAppNotification(mgrId, {
        title: `Day End Pending Digest (${dateStr})`,
        message: `${pendingItems.length} team member(s) have not submitted their Day End report for today: ${pendingItems.map((i) => i.user.name || i.user.email).join(', ')}.`,
        type: 'warning',
        entity_type: 'manager_digest',
      });

      // Digest Email to Manager
      if (manager.email) {
        const execRows = pendingItems
          .map(
            (item, i) => `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 600;">${i + 1}. ${escapeHtml(item.user.name || item.user.email)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">${escapeHtml(item.plan?.plan_type || 'Visits')}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: center;"><span style="color: #b91c1c; font-weight: 700; font-size: 11px; background: #fee2e2; padding: 2px 8px; border-radius: 9999px;">${escapeHtml(item.plan?.status || 'Incomplete')}</span></td>
            </tr>
          `
          )
          .join('');

        const digestHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <div style="background-color: #1e293b; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">Team Day End Pending Digest</h2>
              <p style="margin: 0; font-size: 13px; opacity: 0.85;">Evening 6:00 PM Check • <strong>${dateStr}</strong></p>
            </div>
            <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
              <p style="font-size: 14px; margin-top: 0;">Hi <strong>${escapeHtml(mgrName)}</strong>,</p>
              <p style="font-size: 13px; color: #334155;">
                The following <strong>${pendingItems.length}</strong> team member(s) have not submitted their Day End report for today (<strong>${dateStr}</strong>):
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Executive</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px;">Plan Type</th>
                    <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: center; font-size: 12px;">Plan Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${execRows}
                </tbody>
              </table>
              <div style="margin: 20px 0 10px 0; text-align: center;">
                <a href="${(FRONTEND_URL || '').replace(/\/$/, '')}/work-plans" style="background-color: #1e293b; color: #ffffff; padding: 9px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
                  Open Work Planner
                </a>
              </div>
            </div>
          </div>
        `;

        await emailHelper.sendEmail(
          manager.email,
          `Team Day End Pending Digest — ${dateStr} (${pendingItems.length} Pending)`,
          '',
          digestHtml
        ).catch((err) => {
          logger.warn(`[AutoNotification] Failed sending 6 PM digest to manager ${manager.email}: ${err.message}`);
        });
      }
    }
  } catch (err) {
    logger.error(`[AutoNotification] Error in sendPendingDayEndEveningReminder: ${err.message}`);
  }
}

module.exports = {
  getWorkPlannerPortalRoles,
  isWpExecutive,
  isWpManager,
  isWpAdmin,
  getActiveUsersByWpRole,
  getWorkPlannerManagers,
  resolveStakeholders,
  sendInAppNotification,
  notifyWorkPlanCreated,
  notifyVisitCreated,
  notifyTaskCreated,
  notifyDayEndCompleted,
  sendPendingWorkPlanMorningReminder,
  sendPendingDayEndEveningReminder,
  renderVisitsTable,
  renderTasksTable,
};
