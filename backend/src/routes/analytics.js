import { Router } from "express";
import LoanApplication from "../models/LoanApplication.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Portfolio summary — uses aggregation pipeline instead of loading all records
router.get("/summary", requireAuth, async (_req, res) => {
  try {
    const [result] = await LoanApplication.aggregate([
      {
        $group: {
          _id: null,
          totalLoans: { $sum: 1 },
          highRisk: { $sum: { $cond: [{ $eq: ["$riskLevel", "HIGH"] }, 1, 0] } },
          mediumRisk: { $sum: { $cond: [{ $eq: ["$riskLevel", "MEDIUM"] }, 1, 0] } },
          lowRisk: { $sum: { $cond: [{ $eq: ["$riskLevel", "LOW"] }, 1, 0] } },
          totalLoanValue: { $sum: { $ifNull: ["$loanAmount", 0] } },
          avgCreditScore: { $avg: "$creditScore" },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        },
      },
    ]);

    if (!result) {
      return res.json({
        totalLoans: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0,
        totalLoanValue: 0, avgCreditScore: 0, approvalRate: 0,
      });
    }

    const approvalRate = result.totalLoans > 0
      ? (result.approved / result.totalLoans) * 100
      : 0;

    res.json({
      totalLoans: result.totalLoans,
      highRisk: result.highRisk,
      mediumRisk: result.mediumRisk,
      lowRisk: result.lowRisk,
      totalLoanValue: result.totalLoanValue,
      avgCreditScore: result.avgCreditScore || 0,
      approvalRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chart data — uses aggregation pipelines
router.get("/charts", requireAuth, async (_req, res) => {
  try {
    // Risk distribution
    const riskAgg = await LoanApplication.aggregate([
      { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
    ]);
    const riskMap = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    riskAgg.forEach((r) => { if (r._id in riskMap) riskMap[r._id] = r.count; });
    const riskDistribution = [
      { label: "High Risk", value: riskMap.HIGH },
      { label: "Medium Risk", value: riskMap.MEDIUM },
      { label: "Low Risk", value: riskMap.LOW },
    ];

    // Approval trend — last 6 months with correct year boundary handling
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const trendAgg = await LoanApplication.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          high: { $sum: { $cond: [{ $eq: ["$riskLevel", "HIGH"] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ["$riskLevel", "MEDIUM"] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ["$riskLevel", "LOW"] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Build the 6-month series (fill in zeros for missing months)
    const approvalTrend = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1; // $month returns 1-indexed
      const found = trendAgg.find((t) => t._id.year === year && t._id.month === monthNum);
      approvalTrend.push({
        month: monthNames[d.getMonth()],
        high: found?.high || 0,
        medium: found?.medium || 0,
        low: found?.low || 0,
        total: found?.total || 0,
      });
    }

    // Income vs default risk
    const incomeRanges = [
      { label: "< ₹30k", min: 0, max: 30000 },
      { label: "₹30k-₹60k", min: 30000, max: 60000 },
      { label: "₹60k-₹1L", min: 60000, max: 100000 },
      { label: "₹1L-₹1.5L", min: 100000, max: 150000 },
      { label: "> ₹1.5L", min: 150000, max: Infinity },
    ];

    const incomeAgg = await LoanApplication.aggregate([
      {
        $bucket: {
          groupBy: "$income",
          boundaries: [0, 30000, 60000, 100000, 150000],
          default: 150000,
          output: {
            count: { $sum: 1 },
            defaults: { $sum: { $cond: [{ $eq: ["$prediction", 1] }, 1, 0] } },
          },
        },
      },
    ]);

    const bucketMap = {};
    incomeAgg.forEach((b) => { bucketMap[b._id] = b; });

    const incomeVsDefaultRisk = incomeRanges.map((range) => {
      const key = range.min >= 150000 ? 150000 : range.min;
      const bucket = bucketMap[key];
      return {
        incomeRange: range.label,
        defaultRate: bucket && bucket.count > 0 ? (bucket.defaults / bucket.count) * 100 : 0,
        count: bucket?.count || 0,
      };
    });

    res.json({ riskDistribution, approvalTrend, incomeVsDefaultRisk });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/loan/:id", requireAuth, async (req, res) => {
  try {
    const loan = await LoanApplication.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    // Feature importance — approximate values from RandomForest model analysis
    // TODO: Extract actual importances from the trained model via ML API
    const featureImportance = [
      { feature: "Credit Score", importance: 0.32 },
      { feature: "Income", importance: 0.24 },
      { feature: "Loan Amount", importance: 0.18 },
      { feature: "Debt-to-Income", importance: 0.14 },
      { feature: "Employment Status", importance: 0.08 },
      { feature: "Age", importance: 0.04 },
    ];

    // Credit score vs risk — aggregation with limit
    const creditScoreVsRisk = await LoanApplication.aggregate([
      { $match: { probability: { $ne: null } } },
      { $project: { creditScore: 1, probability: 1, riskLevel: 1 } },
      { $sort: { creditScore: 1 } },
      { $limit: 50 },
    ]);

    // Loan amount vs risk — aggregation with limit
    const loanAmountVsRisk = await LoanApplication.aggregate([
      { $match: { probability: { $ne: null } } },
      { $project: { loanAmount: 1, probability: 1 } },
      { $sort: { loanAmount: 1 } },
      { $limit: 30 },
    ]);

    // Risk distribution
    const riskAgg = await LoanApplication.aggregate([
      { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
    ]);
    const riskMap = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    riskAgg.forEach((r) => { if (r._id in riskMap) riskMap[r._id] = r.count; });
    const riskDistribution = [
      { label: "High Risk", value: riskMap.HIGH },
      { label: "Medium Risk", value: riskMap.MEDIUM },
      { label: "Low Risk", value: riskMap.LOW },
    ];

    res.json({ featureImportance, creditScoreVsRisk, loanAmountVsRisk, riskDistribution });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;