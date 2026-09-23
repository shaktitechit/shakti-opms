/**
 * @fileoverview ESM mongoose mirror for WorkPlanWork.
 * @module models/WorkPlanWork
 */

import mongoose from "mongoose";

const workPlanWorkSchema = new mongoose.Schema(
  {
    work_plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkPlan",
      required: false,
      default: null,
      index: true,
    },
    sales_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      enum: ["created", "pending", "in_progress", "completed", "cancelled"],
      default: "created",
      index: true,
    },
    completion_remarks: { type: String, trim: true },
    pending_remarks: { type: String, trim: true },
    in_progress_remarks: { type: String, trim: true },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    created_by_role: { type: String, trim: true },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    partialFilterExpression: { work_plan: { $type: "objectId" }, deletedAt: null },
  }
);

export default mongoose.models.WorkPlanWork ||
  mongoose.model("WorkPlanWork", workPlanWorkSchema);
