/**
 * @fileoverview Registers all mongoose models/schemas used by work-planner-backend.
 * @module data/mongoRegistry
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

let _cached = null;

function registerModels() {
  // User schema
  if (!mongoose.models.User) {
    const userSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        phone: { type: String, trim: true },
        department: { type: String, trim: true },
        roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
        portals: [
          {
            portal: { type: mongoose.Schema.Types.ObjectId, ref: 'Portal' },
            portal_code: { type: String, trim: true },
            access_roles: [{ type: String, trim: true }],
          },
        ],
        is_active: { type: Boolean, default: true },
      },
      { timestamps: true }
    );
    mongoose.model('User', userSchema);
  }

  // Party schema
  if (!mongoose.models.Party) {
    const partySchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        party_name: { type: String, required: true, trim: true },
        legal_name: { type: String, trim: true },
        party_type: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    partySchema.plugin(softDeletePlugin);
    mongoose.model('Party', partySchema);
  }

  // Attachment schema
  if (!mongoose.models.Attachment) {
    const attachmentSchema = new mongoose.Schema(
      {
        filename: { type: String, required: true },
        original_name: { type: String, required: true },
        mime_type: { type: String, required: true },
        size: { type: Number, required: true },
        storage_path: { type: String, required: true },
        url: { type: String },
      },
      { timestamps: true }
    );
    mongoose.model('Attachment', attachmentSchema);
  }

  // Notification schema
  if (!mongoose.models.Notification) {
    const notificationSchema = new mongoose.Schema(
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        type: { type: String, default: 'info' },
        module: { type: String, default: 'work_planner' },
        entity_type: String,
        entity_id: mongoose.Schema.Types.ObjectId,
        is_read: { type: Boolean, default: false, index: true },
        read_at: Date,
      },
      { timestamps: true }
    );
    mongoose.model('Notification', notificationSchema);
  }

  // ActivityLog schema
  if (!mongoose.models.ActivityLog) {
    const activityLogSchema = new mongoose.Schema(
      {
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        entity_type: { type: String, required: true, index: true },
        entity_id: { type: mongoose.Schema.Types.ObjectId, index: true },
        action: { type: String, required: true },
        message: String,
        old_value: mongoose.Schema.Types.Mixed,
        new_value: mongoose.Schema.Types.Mixed,
        ip_address: String,
        user_agent: String,
      },
      { timestamps: true }
    );
    mongoose.model('ActivityLog', activityLogSchema);
  }

  // WorkPlan schema
  const WORK_PLAN_STATUSES = ['planned', 'draft', 'submitted', 'approved', 'rejected', 'completed'];
  if (!mongoose.models.WorkPlan) {
    const workPlanSchema = new mongoose.Schema(
      {
        company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyInfo', index: true },
        plan_date: { type: Date, required: true, index: true },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        status: {
          type: String,
          enum: WORK_PLAN_STATUSES,
          default: 'planned',
          index: true,
        },
        plan_type: {
          type: String,
          enum: ['Visits', 'Tasks & Visits', 'Leave', 'Work From Home', 'Work From Office'],
          default: 'Visits',
          index: true,
        },
        remarks: { type: String, trim: true },
        location: { type: String, trim: true },
        is_discussed_with_manager: { type: Boolean, default: false },
        discussed_manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        discussed_manager_name: { type: String, trim: true },
        discussion_method: {
          type: String,
          enum: ['on_call', 'on_direct_meeting', 'on_email', 'other'],
        },
        submitted_at: Date,
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approved_at: Date,
        rejection_reason: { type: String, trim: true },
        day_end: {
          completed_at: Date,
          from_email: { type: String, trim: true },
          to_email: { type: String, trim: true },
          cc_emails: [{ type: String, trim: true }],
          subject: { type: String, trim: true },
          body_html: { type: String },
          attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
        },
        deletedAt: { type: Date, default: null, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    workPlanSchema.index(
      { sales_user: 1, plan_date: 1 },
      {
        unique: true,
        partialFilterExpression: { deletedAt: null },
      }
    );
    workPlanSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlan', workPlanSchema);
  }

  // WorkPlanVisit schema
  const WORK_PLAN_VISIT_STATUSES = [
    'created',
    'pending',
    'in_progress',
    'checked_in',
    'completed',
    'cancelled',
    'skipped',
    'rescheduled',
  ];
  if (!mongoose.models.WorkPlanVisit) {
    const workPlanVisitSchema = new mongoose.Schema(
      {
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          required: false,
          default: null,
          index: true,
        },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: false,
          index: true,
        },
        plan_date: {
          type: Date,
          required: false,
          index: true,
        },
        sequence: { type: Number, required: true, min: 1, default: 1 },
        party_type: {
          type: String,
          enum: ['existing', 'new_party', 'new_lead', 'existing_lead'],
          default: 'existing',
          index: true,
        },
        party: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Party',
          required: false,
          index: true,
        },
        party_name: { type: String, trim: true },
        contact_person: { type: String, trim: true },
        contact_number: { type: String, trim: true },
        contact_email: { type: String, trim: true, lowercase: true },
        contacts: [
          {
            contact_person: { type: String, trim: true },
            contact_number: { type: String, trim: true },
            contact_email: { type: String, trim: true, lowercase: true },
          },
        ],
        address: { type: String, trim: true },
        planned_start_time: Date,
        planned_end_time: Date,
        purpose: { type: String, trim: true },
        notes: { type: String, trim: true },
        status: {
          type: String,
          enum: WORK_PLAN_VISIT_STATUSES,
          default: 'created',
          index: true,
        },
        pending_remarks: { type: String, trim: true },
        in_progress_remarks: { type: String, trim: true },
        created_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        created_by_role: { type: String, trim: true },
        updated_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        updated_by_role: { type: String, trim: true },
        actual_check_in: Date,
        actual_check_out: Date,
        outcome: { type: String, trim: true },
        meeting_with_doctor: { type: Boolean },
        meeting_with_purchase: { type: Boolean },
        meeting_with_finance: { type: Boolean },
        meeting_with_engineer: { type: Boolean },
        new_product_introduced: { type: Boolean },
        order_received: { type: Boolean },
        next_followup_date: Date,
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    workPlanVisitSchema.index(
      { work_plan: 1, sequence: 1 },
      {
        unique: true,
        partialFilterExpression: { work_plan: { $type: 'objectId' }, deletedAt: null },
      }
    );
    workPlanVisitSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanVisit', workPlanVisitSchema);
  }

  // WorkPlanWork schema
  if (!mongoose.models.WorkPlanWork) {
    const workPlanWorkSchema = new mongoose.Schema(
      {
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          required: false,
          default: null,
          index: true,
        },
        sales_user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: false,
          index: true,
        },
        plan_date: {
          type: Date,
          required: false,
          index: true,
        },
        sequence: { type: Number, required: true, min: 1, default: 1 },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        planned_start_time: Date,
        planned_end_time: Date,
        status: {
          type: String,
          enum: ['created', 'pending', 'in_progress', 'completed', 'cancelled'],
          default: 'created',
          index: true,
        },
        completion_remarks: { type: String, trim: true },
        pending_remarks: { type: String, trim: true },
        in_progress_remarks: { type: String, trim: true },
        created_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        created_by_role: { type: String, trim: true },
        updated_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          index: true,
        },
        updated_by_role: { type: String, trim: true },
        deletedAt: { type: Date, default: null, index: true },
      },
      { timestamps: true }
    );
    workPlanWorkSchema.index(
      { work_plan: 1, sequence: 1 },
      {
        unique: true,
        partialFilterExpression: { work_plan: { $type: 'objectId' }, deletedAt: null },
      }
    );
    workPlanWorkSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanWork', workPlanWorkSchema);
  }

  // WorkPlanExpense schema
  const WORK_PLAN_EXPENSE_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];
  const WORK_PLAN_EXPENSE_CATEGORIES = [
    'Travel',
    'Accommodation',
    'Food',
    'Communication',
    'Client Entertainment',
    'Marketing',
    'Office',
    'Miscellaneous',
  ];
  const WORK_PLAN_EXPENSE_PAYMENT_MODES = [
    'Cash',
    'UPI',
    'Card',
    'Bank Transfer',
    'Company Card',
  ];

  if (!mongoose.models.WorkPlanExpense) {
    const workPlanExpenseSchema = new mongoose.Schema(
      {
        work_plan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlan',
          required: true,
          index: true,
        },
        work_plan_visit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkPlanVisit',
          default: null,
          index: true,
        },
        expense_date: { type: Date, required: true, index: true },
        category: {
          type: String,
          enum: WORK_PLAN_EXPENSE_CATEGORIES,
          required: true,
          index: true,
        },
        sub_category: { type: String, trim: true },
        amount: { type: Number, required: true, min: 0 },
        payment_mode: {
          type: String,
          enum: WORK_PLAN_EXPENSE_PAYMENT_MODES,
          required: true,
        },
        vendor_name: { type: String, trim: true },
        bill_number: { type: String, trim: true },
        bill_date: Date,
        description: { type: String, trim: true },
        receipt_attachment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attachment',
          default: null,
        },
        start_reading: { type: Number, min: 0 },
        closing_reading: { type: Number, min: 0 },
        start_reading_image: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attachment',
          default: null,
        },
        end_reading_image: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attachment',
          default: null,
        },
        status: {
          type: String,
          enum: WORK_PLAN_EXPENSE_STATUSES,
          default: 'draft',
          index: true,
        },
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approved_at: Date,
        rejection_reason: { type: String, trim: true },
        deletedAt: { type: Date, default: null, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    workPlanExpenseSchema.index({ work_plan: 1, status: 1, deletedAt: 1 });
    workPlanExpenseSchema.plugin(softDeletePlugin);
    mongoose.model('WorkPlanExpense', workPlanExpenseSchema);
  }

  // UserWorkPlannerSettings schema
  if (!mongoose.models.UserWorkPlannerSettings) {
    const userWorkPlannerSettingsSchema = require('../models/UserWorkPlannerSettings');
    mongoose.model('UserWorkPlannerSettings', userWorkPlannerSettingsSchema);
  }

  // WorkPlannerReportingEdge — who reports to whom (executive→manager, manager→admin)
  if (!mongoose.models.WorkPlannerReportingEdge) {
    const reportingEdgeSchema = new mongoose.Schema(
      {
        subordinate: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        manager: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        subordinate_role: {
          type: String,
          enum: ['executive', 'manager'],
          required: true,
        },
        manager_role: {
          type: String,
          enum: ['manager', 'admin'],
          required: true,
        },
        is_active: { type: Boolean, default: true, index: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );
    reportingEdgeSchema.index(
      { subordinate: 1 },
      { unique: true, partialFilterExpression: { is_active: true } }
    );
    mongoose.model('WorkPlannerReportingEdge', reportingEdgeSchema);
  }

  _cached = {
    User: mongoose.model('User'),
    CompanyInfo: mongoose.models.CompanyInfo || null,
    Party: mongoose.model('Party'),
    Attachment: mongoose.model('Attachment'),
    Notification: mongoose.model('Notification'),
    ActivityLog: mongoose.model('ActivityLog'),
    WorkPlan: mongoose.model('WorkPlan'),
    WorkPlanVisit: mongoose.model('WorkPlanVisit'),
    WorkPlanWork: mongoose.model('WorkPlanWork'),
    WorkPlanExpense: mongoose.model('WorkPlanExpense'),
    UserWorkPlannerSettings: mongoose.model('UserWorkPlannerSettings'),
    WorkPlannerReportingEdge: mongoose.model('WorkPlannerReportingEdge'),
  };

  return _cached;
}

async function fixWorkPlanIndexes() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    for (const colName of ['workplanvisits', 'workplanworks']) {
      try {
        const col = db.collection(colName);
        const indexes = await col.indexes();
        const dupIdx = indexes.find((idx) => idx.name === 'work_plan_1_sequence_1');
        if (dupIdx) {
          const pfe = dupIdx.partialFilterExpression;
          const isCorrect =
            pfe &&
            pfe.work_plan &&
            pfe.work_plan.$type === 'objectId' &&
            pfe.deletedAt === null;
          if (!isCorrect) {
            await col.dropIndex('work_plan_1_sequence_1');
          }
        }
      } catch (e) {
        // collection or index might not exist yet, safe to ignore
      }
    }
  } catch (err) {
    // safe to ignore
  }
}

function getModels() {
  if (_cached) return _cached;
  return registerModels();
}

module.exports = {
  registerModels,
  getModels,
  fixWorkPlanIndexes,
};
