import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '../data/complaints.json');

/**
 * Isolated mock storage helper for CPGRAMS simulation
 */
async function loadComplaints() {
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function saveComplaints(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Mock CPGRAMS Express Router
 * Simulates official CPGRAMS endpoints:
 * - GET /complaints
 * - GET /complaints/:id
 * - PATCH /complaints/:id/status
 */
export const mockCpgramsRouter = express.Router();

// List complaints from mock CPGRAMS
mockCpgramsRouter.get('/complaints', async (req, res, next) => {
  try {
    const data = await loadComplaints();
    let complaints = data.complaints || [];

    if (req.query.department) {
      complaints = complaints.filter(c => c.department === req.query.department);
    }
    if (req.query.status) {
      complaints = complaints.filter(c => c.status === req.query.status);
    }
    if (req.query.officialStatus) {
      complaints = complaints.filter(c => c.officialStatus === req.query.officialStatus);
    }

    res.json({
      success: true,
      source: 'MOCK_CPGRAMS_SERVICE',
      synthetic: true,
      count: complaints.length,
      data: complaints
    });
  } catch (err) {
    next(err);
  }
});

// Get complaint by ID from mock CPGRAMS
mockCpgramsRouter.get('/complaints/:id', async (req, res, next) => {
  try {
    const data = await loadComplaints();
    const complaint = (data.complaints || []).find(c => c.id === req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        source: 'MOCK_CPGRAMS_SERVICE',
        error: `Complaint with id ${req.params.id} not found in mock CPGRAMS`
      });
    }

    res.json({
      success: true,
      source: 'MOCK_CPGRAMS_SERVICE',
      synthetic: true,
      data: complaint
    });
  } catch (err) {
    next(err);
  }
});

// Update complaint status in mock CPGRAMS
mockCpgramsRouter.patch('/complaints/:id/status', async (req, res, next) => {
  try {
    const { officialStatus, status, remarks } = req.body;
    if (!officialStatus && !status) {
      return res.status(400).json({
        success: false,
        error: 'Either officialStatus or status must be provided'
      });
    }

    const data = await loadComplaints();
    const index = (data.complaints || []).findIndex(c => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        source: 'MOCK_CPGRAMS_SERVICE',
        error: `Complaint with id ${req.params.id} not found`
      });
    }

    if (officialStatus) data.complaints[index].officialStatus = officialStatus;
    if (status) data.complaints[index].status = status;
    data.complaints[index].lastUpdated = new Date().toISOString();

    await saveComplaints(data);

    res.json({
      success: true,
      source: 'MOCK_CPGRAMS_SERVICE',
      message: 'Status updated successfully in mock CPGRAMS',
      remarks: remarks || 'Status updated via CPGRAMS mock gateway',
      data: data.complaints[index]
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Isolated Client Adapter
 * When switching to real CPGRAMS API in a future phase,
 * only this adapter interface needs to be swapped out.
 */
export class MockCpgramsClient {
  async fetchAllComplaints(filters = {}) {
    const data = await loadComplaints();
    let complaints = data.complaints || [];
    if (filters.department) {
      complaints = complaints.filter(c => c.department === filters.department);
    }
    return complaints;
  }

  async getComplaintById(id) {
    const data = await loadComplaints();
    return (data.complaints || []).find(c => c.id === id) || null;
  }

  async updateComplaintStatus(id, updateData) {
    const data = await loadComplaints();
    const index = (data.complaints || []).findIndex(c => c.id === id);
    if (index === -1) return null;

    if (updateData.officialStatus) data.complaints[index].officialStatus = updateData.officialStatus;
    if (updateData.status) data.complaints[index].status = updateData.status;
    data.complaints[index].lastUpdated = new Date().toISOString();
    await saveComplaints(data);
    return data.complaints[index];
  }
}

export default mockCpgramsRouter;
