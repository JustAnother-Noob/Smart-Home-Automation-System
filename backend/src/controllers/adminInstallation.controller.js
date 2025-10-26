

const Installation = require('../models/installation.model');
const Order = require('../models/order.model');
const { ResponseUtils } = require('../utils');
const mongoose = require('mongoose');
const { sendInstallationStatusEmail: sendStatusEmail } = require('../services/email.services');

async function getAllInstallations(req, res) {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      from,
      to,
      search,
      sort = 'newest',
    } = req.query;

    const query = {};

    if (status && status.trim() !== '') {
      const normalized = status.trim().toLowerCase();
      if (['pending', 'confirmed', 'completed', 'cancelled'].includes(normalized)) {
        query.status = normalized;
      }
    }

    if (from || to) {
      query.installationDate = {};
      if (from) query.installationDate.$gte = new Date(from);
      if (to) query.installationDate.$lte = new Date(to);
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      const searchConditions = [];

      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(searchTerm);
      if (isValidObjectId) {
        searchConditions.push({ _id: searchTerm });
      }

      searchConditions.push({ orderNumber: { $regex: searchTerm, $options: 'i' } });

      searchConditions.push({ customerName: { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ customerEmail: { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ address: { $regex: searchTerm, $options: 'i' } });
      searchConditions.push({ contactNumber: { $regex: searchTerm, $options: 'i' } });

      query.$or = searchConditions;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let sortQuery = { installationDate: -1 }; 
    if (sort) {
      switch (sort) {
        case 'newest':
          sortQuery = { createdAt: -1 };
          break;
        case 'oldest':
          sortQuery = { createdAt: 1 };
          break;
        case 'date-asc':
          sortQuery = { installationDate: 1 };
          break;
        case 'date-desc':
          sortQuery = { installationDate: -1 };
          break;
        case 'status':
          sortQuery = { status: 1 };
          break;
        default:
          sortQuery = { installationDate: -1 };
      }
    }

    const [installations, total] = await Promise.all([
      Installation.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'firstName lastName email')
        .populate('orderId', 'orderNumber total'),
      Installation.countDocuments(query),
    ]);

    const formattedInstallations = installations.map((installation) => {
      const plain = installation.toObject ? installation.toObject() : installation;
      return {
        _id: plain._id,
        orderNumber: plain.orderNumber,
        orderId: plain.orderId?._id || plain.orderId,
        order: plain.orderId, 
        customerName: plain.customerName,
        customerEmail: plain.customerEmail,
        contactNumber: plain.contactNumber,
        address: plain.address,
        installationDate: plain.installationDate,
        status: plain.status,
        assignedTechnician: plain.assignedTechnician,
        notes: plain.notes,
        createdBy: plain.createdBy,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
      };
    });

    return res.json({
      success: true,
      installations: formattedInstallations,
      count: installations.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error fetching installations:', error);
    return ResponseUtils.error(res, 'Failed to fetch installations');
  }
}

async function getInstallationDetails(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseUtils.validationError(res, 'Invalid installation ID');
    }

    const installation = await Installation.findById(id)
      .populate('createdBy', 'firstName lastName email phone')
      .populate('orderId', 'orderNumber total items');

    if (!installation) {
      return ResponseUtils.notFound(res, 'Installation');
    }

    const formatted = {
      ...installation.toObject(),
      order: installation.orderId,
    };

    return res.json({ success: true, installation: formatted });
  } catch (error) {
    console.error('Error fetching installation details:', error);
    return ResponseUtils.error(res, 'Failed to fetch installation details');
  }
}

async function updateInstallationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, sendEmail } = req.body;

    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    const normalized = (status || '').toLowerCase().trim();
    
    if (!normalized || !allowed.includes(normalized)) {
      return ResponseUtils.validationError(res, 'Invalid status. Must be one of: ' + allowed.join(', '));
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseUtils.validationError(res, 'Invalid installation ID');
    }

    const existing = await Installation.findById(id);
    if (!existing) {
      return ResponseUtils.notFound(res, 'Installation');
    }

    const oldStatus = existing.status;

    const updateData = { 
      status: normalized, 
      updatedAt: Date.now() 
    };

    const updated = await Installation.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email')
      .populate('orderId', 'orderNumber total');

    if (oldStatus !== normalized && sendEmail === true) {
      try {
        if (updated.customerEmail) {
          await sendStatusEmail(updated, normalized, updated.customerEmail);
          console.log(`✅ Installation status email sent to ${updated.customerEmail}`);
        } else {
          console.log('⚠️  No customer email found, skipping email notification');
        }
      } catch (emailError) {
        console.error('Error sending installation status email:', emailError);
        
      }
    } else if (oldStatus !== normalized) {
      console.log('📧 Email notification skipped (checkbox unchecked or not provided)');
    }

    return res.json({ 
      success: true, 
      installation: updated,
      message: 'Installation status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating installation status:', error);
    return ResponseUtils.error(res, 'Failed to update installation status');
  }
}

async function deleteInstallation(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseUtils.validationError(res, 'Invalid installation ID');
    }

    const installation = await Installation.findById(id);
    if (!installation) {
      return ResponseUtils.notFound(res, 'Installation');
    }

    if (installation.orderId) {
      await Order.findByIdAndUpdate(
        installation.orderId,
        { installationBooked: false }
      );
    }

    await Installation.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Installation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting installation:', error);
    return ResponseUtils.error(res, 'Failed to delete installation');
  }
}

async function sendInstallationStatusEmail(req, res) {
  try {
    const { id } = req.params;
    const { status, email } = req.body;

    if (!email || !status) {
      return ResponseUtils.validationError(
        res,
        'Email and status are required'
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseUtils.validationError(res, 'Invalid installation ID');
    }

    const installation = await Installation.findById(id)
      .populate('orderId', 'orderNumber total');
    
    if (!installation) {
      return ResponseUtils.notFound(res, 'Installation');
    }

    try {
      await sendStatusEmail(installation, status, email);
      
      return res.json({
        success: true,
        message: 'Installation status email sent successfully',
      });
    } catch (emailError) {
      console.error('Error sending installation status email:', emailError);
      return res.json({
        success: false,
        message: 'Failed to send email notification',
      });
    }
  } catch (error) {
    console.error('Error sending installation status email:', error);
    return ResponseUtils.error(res, 'Failed to send email notification', 500);
  }
}

module.exports = {
  getAllInstallations,
  getInstallationDetails,
  updateInstallationStatus,
  deleteInstallation,
  sendInstallationStatusEmail,
};

