

const Installation = require('../models/installation.model');
const mongoose = require('mongoose');
const { sendInstallationNotificationEmail, sendInstallationAdminNotificationEmail } = require('../services/email.services');

exports.getAvailableInstallations = async (req, res) => {
  try {
    const today = new Date();
    const installations = await Installation.find({
      installationDate: { $gte: today },
      status: { $in: ['pending', 'confirmed'] }
    }).sort({ installationDate: 1 });

    res.json({ success: true, data: installations });
  } catch (error) {
    console.error('Error fetching available installations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available installations' });
  }
};

exports.bookInstallation = async (req, res) => {
  try {
    const { customerName, contactNumber, customerEmail, address, orderId, installationDate, notes } = req.body;

    if (!customerName || !contactNumber || !customerEmail || !address || !orderId || !installationDate) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const Order = require('../models/order.model');
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.installationBooked) {
      return res.status(400).json({
        success: false,
        message: 'Installation has already been booked for this order'
      });
    }

    const bookingData = {
      customerName,
      contactNumber,
      customerEmail,
      address,
      orderId,
      orderNumber: order.orderNumber, 
      installationDate,
      notes
    };

    if (req.user && req.user.id) {
      bookingData.createdBy = req.user.id;
    }

    const newBooking = await Installation.create(bookingData);

    console.log('✅ Installation created:', {
      _id: newBooking._id,
      customerName: newBooking.customerName,
      address: newBooking.address,
      orderNumber: newBooking.orderNumber,
      installationDate: newBooking.installationDate
    });

    order.installationBooked = true;
    await order.save();

    await newBooking.populate('orderId');

    console.log('📧 Sending emails with installation data:', {
      customerName: newBooking.customerName,
      customerEmail: newBooking.customerEmail,
      address: newBooking.address,
      orderNumber: newBooking.orderNumber
    });

    try {
      await sendInstallationNotificationEmail(newBooking, 'created');
      await sendInstallationAdminNotificationEmail(newBooking, 'created');
    } catch (emailError) {
      console.error('Error sending booking emails:', emailError);
      
    }

    res.status(201).json({ success: true, message: 'Booking request submitted', data: newBooking });
  } catch (error) {
    console.error('Error booking installation:', error);
    res.status(500).json({ success: false, message: 'Failed to book installation' });
  }
};

exports.getUserInstallations = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const installations = await Installation.find({ createdBy: userId })
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ installationDate: -1 }); 

    res.status(200).json({
      success: true,
      data: installations,
      count: installations.length
    });
  } catch (error) {
    console.error('❌ Error fetching user installations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch installations' });
  }
};

exports.getAllInstallations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search;
    const technician = req.query.technician;
    const from = req.query.from;
    const to = req.query.to;
    const sortBy = req.query.sortBy || 'installationDate';
    const sortDir = req.query.sortDir === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;

    let query = {};

    if (status && status !== '') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { productInstalled: searchRegex },
        { address: searchRegex }
      ];
    }

    if (technician && technician.trim() !== '') {
      const techRegex = new RegExp(technician.trim(), 'i');
      query.assignedTechnician = techRegex;
    }

    if (from || to) {
      query.installationDate = {};
      if (from) {
        query.installationDate.$gte = new Date(from);
      }
      if (to) {
        query.installationDate.$lte = new Date(to);
      }
    }

    const totalInstallations = await Installation.countDocuments(query);
    const totalPages = Math.ceil(totalInstallations / limit);

    const sortObject = {};
    sortObject[sortBy] = sortDir;

    const installations = await Installation
      .find(query)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'email name')
      .lean();

    res.json({ 
      success: true, 
      installations: installations,
      totalPages: totalPages,
      currentPage: page,
      totalInstallations: totalInstallations
    });
  } catch (error) {
    console.error('Error fetching installations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch installations' });
  }
};

exports.getInstallation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid installation ID' });
    }

    const installation = await Installation.findById(id).populate('createdBy', 'email name');

    if (!installation) {
      return res.status(404).json({ success: false, message: 'Installation not found' });
    }

    res.json({ success: true, data: installation });
  } catch (error) {
    console.error('Error fetching installation:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch installation' });
  }
};

exports.createInstallation = async (req, res) => {
  try {
    const { customerName, contactNumber, customerEmail, address, productInstalled, installationDate, assignedTechnician, notes } = req.body;

    if (!customerName || !contactNumber || !customerEmail || !address || !productInstalled || !installationDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'All required fields must be filled: customerName, contactNumber, customerEmail, address, productInstalled, installationDate' 
      });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const installation = await Installation.create({
      createdBy: req.user.id, 
      customerName,
      contactNumber,
      customerEmail,
      address,
      productInstalled,
      installationDate,
      assignedTechnician: assignedTechnician || '',
      notes: notes || '',
      status: 'pending' 
    });

    try {
      await sendInstallationNotificationEmail(installation, 'created');
      await sendInstallationAdminNotificationEmail(installation, 'created');
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      
    }

    res.status(201).json({ success: true, data: installation, message: 'Installation created successfully' });
  } catch (error) {
    console.error('Error creating installation:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${validationErrors.join(', ')}` 
      });
    }
    
    res.status(500).json({ success: false, message: 'Failed to create installation' });
  }
};

exports.updateInstallation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid installation ID' });
    }

    const currentInstallation = await Installation.findById(id);
    if (!currentInstallation) {
      return res.status(404).json({ success: false, message: 'Installation not found' });
    }

    if (req.body.customerEmail) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(req.body.customerEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }
    }

    const updated = await Installation.findByIdAndUpdate(id, req.body, { 
      new: true, 
      runValidators: true 
    }).populate('createdBy', 'email name');

    try {
      await sendInstallationNotificationEmail(updated, 'updated');
      await sendInstallationAdminNotificationEmail(updated, 'updated');
    } catch (emailError) {
      console.error('Error sending update emails:', emailError);
      
    }

    if (req.body.status && req.body.status !== currentInstallation.status) {
      try {
        await sendInstallationNotificationEmail(updated, 'status_changed');
      } catch (emailError) {
        console.error('Error sending status change email:', emailError);
      }
    }

    res.json({ success: true, data: updated, message: 'Installation updated successfully' });
  } catch (error) {
    console.error('Error updating installation:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${validationErrors.join(', ')}` 
      });
    }
    
    res.status(500).json({ success: false, message: 'Failed to update installation' });
  }
};

exports.deleteInstallation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid installation ID' });
    }

    const deleted = await Installation.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Installation not found' });
    }

    res.json({ success: true, message: 'Installation deleted successfully' });
  } catch (error) {
    console.error('Error deleting installation:', error);
    res.status(500).json({ success: false, message: 'Failed to delete installation' });
  }
};

exports.confirmInstallation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid installation ID' });
    }

    const booking = await Installation.findByIdAndUpdate(
      id,
      { status: 'confirmed' },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, message: 'Booking confirmed', data: booking });
  } catch (error) {
    console.error('Error confirming installation:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm booking' });
  }
};
