

class PrintUtils {
  constructor() {
    this.printStyles = `
      <link rel="stylesheet" href="../css/print.css" />
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    `;
  }

  printInstallation(installation) {
    try {
      console.log('PrintUtils.printInstallation called with:', installation);
      
      if (!installation) {
        console.error('No installation data provided');
        alert('No installation data available to print');
        return;
      }

      const printContent = this.generateReceiptPrintContent(installation);
      console.log('Generated receipt content length:', printContent.length);
      
      this.printContent(printContent, `Installation-Receipt-${installation.id || installation._id || 'Details'}`);
    } catch (error) {
      console.error('Error in printInstallation:', error);
      alert('Failed to generate print content: ' + error.message);
    }
  }

  printOrder(order) {
    const printContent = this.generateOrderReceiptContent(order);
    this.printContent(printContent, `Order-Receipt-${order.orderNumber || order.id || 'Details'}`);
  }

  printNetworkLogs(logs, filters = {}) {
    const printContent = this.generateNetworkLogsPrintContent(logs, filters);
    this.printContent(printContent, 'Network-Logs-Report');
  }

  printInstallationsList(installations, filters = {}) {
    const printContent = this.generateInstallationsListPrintContent(installations, filters);
    this.printContent(printContent, 'Installations-List');
  }

  printOrdersList(orders, filters = {}) {
    const printContent = this.generateOrdersListPrintContent(orders, filters);
    this.printContent(printContent, 'Orders-List');
  }

  generateReceiptPrintContent(installation) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const installationDate = this.formatDateTime(installation.installationDate);
    const status = (installation.status || 'pending').toUpperCase();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Installation Receipt - ${installation.id || 'N/A'}</title>
        <style>
          @page {
            margin: 0.25in;
            size: A4;
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            max-width: 3.5in;
            margin: 0 auto;
            background: white;
            padding: 5px;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .receipt-header h1 {
            margin: 0;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .receipt-header .company-info {
            font-size: 10px;
            margin: 2px 0;
          }
          .receipt-header .print-date {
            font-size: 9px;
            margin-top: 2px;
          }
          .receipt-id {
            text-align: center;
            margin: 8px 0;
            padding: 5px;
            border: 1px solid #000;
          }
          .receipt-id h2 {
            margin: 0 0 3px 0;
            font-size: 12px;
            font-weight: bold;
          }
          .receipt-id .id-number {
            font-size: 14px;
            font-weight: bold;
          }
          .section {
            margin: 8px 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 5px;
          }
          .section h3 {
            margin: 0 0 5px 0;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            font-size: 10px;
          }
          .detail-label {
            font-weight: bold;
            min-width: 80px;
          }
          .detail-value {
            text-align: right;
            flex: 1;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border: 1px solid #000;
            font-weight: bold;
            font-size: 9px;
            text-transform: uppercase;
          }
          .status-pending { background: #fff; }
          .status-confirmed { background: #e6f3ff; }
          .status-completed { background: #e6ffe6; }
          .status-cancelled { background: #ffe6e6; }
          .notes-section {
            margin: 8px 0;
            padding: 5px;
            border: 1px solid #000;
            background: #f9f9f9;
          }
          .notes-section h3 {
            margin: 0 0 3px 0;
            font-size: 10px;
            font-weight: bold;
          }
          .print-footer {
            margin-top: 15px;
            text-align: center;
            font-size: 8px;
            border-top: 1px solid #000;
            padding-top: 5px;
          }
          .print-footer p {
            margin: 2px 0;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>Smart Living Tech</h1>
          <div class="company-info">Smart Home Installation Services</div>
          <div class="print-date">Receipt: ${currentDate}</div>
        </div>

        <div class="receipt-id">
          <h2>Installation Receipt</h2>
          <div class="id-number">#${installation.orderNumber || installation.id || installation._id || 'N/A'}</div>
        </div>

        <div class="section">
          <h3>Customer Information</h3>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${installation.customerName || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Phone:</span>
            <span class="detail-value">${installation.contactNumber || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${installation.customerEmail || 'N/A'}</span>
          </div>
           <div class="detail-row">
             <span class="detail-label">Address:</span>
             <span class="detail-value">${installation.address || 'N/A'}</span>
           </div>
        </div>

        <div class="section">
          <h3>Service Details</h3>
          <div class="detail-row">
            <span class="detail-label">Product:</span>
            <span class="detail-value">${installation.productInstalled || 
              (installation.order && installation.order.items && installation.order.items.length > 0 ? 
                installation.order.items.map(item => item.name || 'Unknown Product').join(', ') : 
                'N/A')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${installationDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">
              <span class="status-badge status-${installation.status || 'pending'}">${status}</span>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Technician:</span>
            <span class="detail-value">${installation.assignedTechnician || 'TBA'}</span>
          </div>
        </div>

        ${installation.notes ? `
        <div class="notes-section">
          <h3>Special Instructions</h3>
          <div>${installation.notes}</div>
        </div>
        ` : ''}

        <div class="divider"></div>

        <div class="print-footer">
          <p><strong>Smart Living Tech</strong></p>
          <p>Professional Smart Home Solutions</p>
          <p>support@smartlivingtech.com | (555) 123-4567</p>
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `;
  }

  generateInstallationPrintContent(installation) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const installationDate = this.formatDateTime(installation.installationDate);
    const status = (installation.status || 'pending').toUpperCase();
    const statusClass = installation.status || 'pending';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Installation Service Receipt - ${installation.id || 'N/A'}</title>
        ${this.printStyles}
        <style>
          @page {
            margin: 0.5in;
            size: A4;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            max-width: 8.5in;
            margin: 0 auto;
            background: white;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 20px;
            border-radius: 8px;
          }
          .receipt-header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            color: #1e40af;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
          }
          .receipt-header .company-info {
            font-size: 16px;
            color: #64748b;
            margin: 8px 0;
            font-weight: 500;
          }
          .receipt-header .print-date {
            font-size: 12px;
            color: #64748b;
            margin-top: 5px;
          }
          .receipt-id {
            background: #f1f5f9;
            padding: 15px;
            border-left: 4px solid #2563eb;
            margin: 20px 0;
            border-radius: 4px;
          }
          .receipt-id h2 {
            margin: 0 0 10px 0;
            font-size: 18px;
            color: #1e40af;
            font-weight: 600;
          }
          .receipt-id .id-number {
            font-size: 20px;
            font-weight: 700;
            color: #1e40af;
            font-family: 'Courier New', monospace;
          }
          .customer-section {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .customer-section h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #1e40af;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
          }
          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .detail-label {
            font-weight: 600;
            color: #475569;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .detail-value {
            font-size: 14px;
            color: #1e293b;
            font-weight: 500;
          }
          .address-section {
            grid-column: 1 / -1;
            margin-top: 10px;
          }
          .status-section {
            background: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #f59e0b;
          }
          .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .status-pending { background: #fef3c7; color: #92400e; border: 2px solid #f59e0b; }
          .status-confirmed { background: #dbeafe; color: #1e40af; border: 2px solid #3b82f6; }
          .status-completed { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
          .status-cancelled { background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; }
          .notes-section {
            background: #f1f5f9;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #64748b;
          }
          .notes-section h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #475569;
            font-weight: 600;
          }
          .print-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
          }
          .print-footer p {
            margin: 5px 0;
          }
          .qr-section {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
          }
          .qr-placeholder {
            width: 100px;
            height: 100px;
            background: #e2e8f0;
            border: 2px dashed #94a3b8;
            margin: 0 auto 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #64748b;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>Smart Living Tech</h1>
          <div class="company-info">Professional Smart Home Installation Services</div>
          <div class="print-date">Receipt Generated: ${currentDate}</div>
        </div>

        <div class="receipt-id">
          <h2>Installation Service Receipt</h2>
          <div class="id-number">#${installation.id || 'N/A'}</div>
        </div>

        <div class="customer-section">
          <h3>Customer Information</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Customer Name</div>
              <div class="detail-value">${installation.customerName || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Contact Number</div>
              <div class="detail-value">${installation.contactNumber || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Email Address</div>
              <div class="detail-value">${installation.customerEmail || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Installation Date</div>
              <div class="detail-value">${installationDate}</div>
            </div>
             <div class="detail-item address-section">
               <div class="detail-label">Service Address</div>
               <div class="detail-value">
                 ${installation.address || 'N/A'}
               </div>
             </div>
          </div>
        </div>

        <div class="customer-section">
          <h3>Service Details</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Product to Install</div>
              <div class="detail-value">${installation.productInstalled || 
                (installation.order && installation.order.items && installation.order.items.length > 0 ? 
                  installation.order.items.map(item => item.name || 'Unknown Product').join(', ') : 
                  'N/A')}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Assigned Technician</div>
              <div class="detail-value">${installation.assignedTechnician || 'To be assigned'}</div>
            </div>
          </div>
        </div>

        <div class="status-section">
          <h3>Service Status</h3>
          <div class="status-badge status-${statusClass}">${status}</div>
        </div>

        ${installation.notes ? `
        <div class="notes-section">
          <h3>Special Instructions & Notes</h3>
          <div class="detail-value">${installation.notes}</div>
        </div>
        ` : ''}

        <div class="qr-section">
          <div class="qr-placeholder">QR Code<br>Placeholder</div>
          <div style="font-size: 10px; color: #64748b;">Scan for tracking information</div>
        </div>

        <div class="print-footer">
          <p><strong>Smart Living Tech - Professional Smart Home Solutions</strong></p>
          <p>This receipt was generated by our automated system</p>
          <p>For support: support@smartlivingtech.com | Phone: (555) 123-4567</p>
          <p>Thank you for choosing Smart Living Tech!</p>
        </div>
      </body>
      </html>
    `;
  }

  generateOrderReceiptContent(order) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const items = order.items || [];
    const subtotal = order.subtotal || 0;
    const tax = order.taxAmount || 0;
    const shipping = order.shippingCost || 0;
    const total = order.total || 0;
    const status = (order.status || 'pending').toUpperCase();
    const address = this.formatAddress(order.shippingAddress || order.billingAddress, 'order');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Order Receipt - ${order.orderNumber || order.id || 'N/A'}</title>
        <style>
          @page {
            margin: 0.25in;
            size: A4;
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            max-width: 3.5in;
            margin: 0 auto;
            background: white;
            padding: 5px;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .receipt-header h1 {
            margin: 0;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .receipt-header .company-info {
            font-size: 10px;
            margin: 2px 0;
          }
          .receipt-header .print-date {
            font-size: 9px;
            margin-top: 2px;
          }
          .receipt-id {
            text-align: center;
            margin: 8px 0;
            padding: 5px;
            border: 1px solid #000;
          }
          .receipt-id h2 {
            margin: 0 0 3px 0;
            font-size: 12px;
            font-weight: bold;
          }
          .receipt-id .id-number {
            font-size: 14px;
            font-weight: bold;
          }
          .section {
            margin: 8px 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 5px;
          }
          .section h3 {
            margin: 0 0 5px 0;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            font-size: 10px;
          }
          .detail-label {
            font-weight: bold;
            min-width: 80px;
          }
          .detail-value {
            text-align: right;
            flex: 1;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border: 1px solid #000;
            font-weight: bold;
            font-size: 9px;
            text-transform: uppercase;
          }
          .status-pending { background: #fff; }
          .status-confirmed { background: #e6f3ff; }
          .status-processing { background: #f0f0ff; }
          .status-shipped { background: #e6ffe6; }
          .status-delivered { background: #e6ffe6; }
          .status-cancelled { background: #ffe6e6; }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
            font-size: 9px;
          }
          .items-table th {
            border: 1px solid #000;
            padding: 3px;
            text-align: left;
            font-weight: bold;
            background: #f0f0f0;
          }
          .items-table td {
            border: 1px solid #000;
            padding: 3px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            font-size: 10px;
          }
          .total-row.final {
            border-top: 1px solid #000;
            font-weight: bold;
            font-size: 12px;
            margin-top: 5px;
            padding-top: 3px;
          }
          .print-footer {
            margin-top: 15px;
            text-align: center;
            font-size: 8px;
            border-top: 1px solid #000;
            padding-top: 5px;
          }
          .print-footer p {
            margin: 2px 0;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>Smart Living Tech</h1>
          <div class="company-info">Order Receipt & Invoice</div>
          <div class="print-date">Receipt: ${currentDate}</div>
        </div>

        <div class="receipt-id">
          <h2>Order Receipt</h2>
          <div class="id-number">#${order.orderNumber || order.id || 'N/A'}</div>
        </div>

        <div class="section">
          <h3>Customer Information</h3>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${order.customerInfo?.firstName && order.customerInfo?.lastName ? 
              `${order.customerInfo.firstName} ${order.customerInfo.lastName}` : 
              order.customerName || order.customer?.name || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">${order.customerInfo?.email || order.customerEmail || order.customer?.email || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Phone:</span>
            <span class="detail-value">${order.customerInfo?.phone || order.customerPhone || order.customer?.phone || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${this.formatDateTime(order.orderDate || order.createdAt)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">
              <span class="status-badge status-${order.status || 'pending'}">${status}</span>
            </span>
          </div>
        </div>

        ${(order.shippingAddress || order.billingAddress) ? `
        <div class="section">
          <h3>${order.shippingAddress ? 'Shipping Address' : 'Billing Address'}</h3>
          <div class="detail-row">
            <span class="detail-label">Address:</span>
            <span class="detail-value">${address.street}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label"></span>
            <span class="detail-value">${address.full}</span>
          </div>
        </div>
        ` : ''}

        ${items.length > 0 ? `
        <div class="section">
          <h3>Order Items</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.productName || item.name || 'N/A'}</td>
                  <td>${item.quantity || 1}</td>
                  <td>$${(item.price || 0).toFixed(2)}</td>
                  <td>$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Order Summary</h3>
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Tax:</span>
            <span>$${tax.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Shipping:</span>
            <span>$${shipping.toFixed(2)}</span>
          </div>
          <div class="total-row final">
            <span>TOTAL:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
        </div>
        ` : ''}

        <div class="divider"></div>

        <div class="print-footer">
          <p><strong>Smart Living Tech</strong></p>
          <p>Professional Smart Home Solutions</p>
          <p>support@smartlivingtech.com | (555) 123-4567</p>
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `;
  }

  generateOrderPrintContent(order) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const items = order.items || [];
    const subtotal = order.subtotal || 0;
    const tax = order.taxAmount || 0;
    const shipping = order.shippingCost || 0;
    const total = order.total || 0;
    const status = (order.status || 'pending').toUpperCase();
    const statusClass = order.status || 'pending';
    const address = this.formatAddress(order.shippingAddress || order.billingAddress, 'order');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Order Receipt - ${order.orderNumber || order.id || 'N/A'}</title>
        ${this.printStyles}
        <style>
          @page {
            margin: 0.5in;
            size: A4;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            max-width: 8.5in;
            margin: 0 auto;
            background: white;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 20px;
            border-radius: 8px;
          }
          .receipt-header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            color: #1e40af;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
          }
          .receipt-header .company-info {
            font-size: 16px;
            color: #64748b;
            margin: 8px 0;
            font-weight: 500;
          }
          .receipt-header .print-date {
            font-size: 12px;
            color: #64748b;
            margin-top: 5px;
          }
          .receipt-id {
            background: #f1f5f9;
            padding: 15px;
            border-left: 4px solid #2563eb;
            margin: 20px 0;
            border-radius: 4px;
          }
          .receipt-id h2 {
            margin: 0 0 10px 0;
            font-size: 18px;
            color: #1e40af;
            font-weight: 600;
          }
          .receipt-id .id-number {
            font-size: 20px;
            font-weight: 700;
            color: #1e40af;
            font-family: 'Courier New', monospace;
          }
          .order-section {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .order-section h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #1e40af;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
          }
          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .detail-label {
            font-weight: 600;
            color: #475569;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .detail-value {
            font-size: 14px;
            color: #1e293b;
            font-weight: 500;
          }
          .status-section {
            background: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #f59e0b;
          }
          .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .status-pending { background: #fef3c7; color: #92400e; border: 2px solid #f59e0b; }
          .status-confirmed { background: #dbeafe; color: #1e40af; border: 2px solid #3b82f6; }
          .status-processing { background: #e0e7ff; color: #3730a3; border: 2px solid #6366f1; }
          .status-shipped { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
          .status-delivered { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
          .status-cancelled { background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; }
          .status-refunded { background: #f3f4f6; color: #374151; border: 2px solid #6b7280; }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .items-table th {
            background: #1e40af;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
          }
          .items-table tr:nth-child(even) {
            background: #f8fafc;
          }
          .items-table tr:last-child td {
            border-bottom: none;
          }
          .totals-section {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            font-size: 14px;
          }
          .total-row.final {
            border-top: 2px solid #1e40af;
            font-weight: 700;
            font-size: 16px;
            margin-top: 10px;
            padding-top: 15px;
            color: #1e40af;
          }
          .print-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
          }
          .print-footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>Smart Living Tech</h1>
          <div class="company-info">Order Receipt & Invoice</div>
          <div class="print-date">Receipt Generated: ${currentDate}</div>
        </div>

        <div class="receipt-id">
          <h2>Order Receipt</h2>
          <div class="id-number">#${order.orderNumber || order.id || 'N/A'}</div>
        </div>

        <div class="order-section">
          <h3>Order Information</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Customer Name</div>
              <div class="detail-value">${order.customerInfo?.firstName && order.customerInfo?.lastName ? 
                `${order.customerInfo.firstName} ${order.customerInfo.lastName}` : 
                order.customerName || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Email Address</div>
              <div class="detail-value">${order.customerInfo?.email || order.customerEmail || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Phone Number</div>
              <div class="detail-value">${order.customerInfo?.phone || order.customerPhone || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Order Date</div>
              <div class="detail-value">${this.formatDateTime(order.orderDate || order.createdAt)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Order Status</div>
              <div class="detail-value">
                <span class="status-badge status-${statusClass}">${status}</span>
              </div>
            </div>
            ${(order.shippingAddress || order.billingAddress) ? `
            <div class="detail-item" style="grid-column: 1 / -1; margin-top: 10px;">
              <div class="detail-label">${order.shippingAddress ? 'Shipping Address' : 'Billing Address'}</div>
              <div class="detail-value">
                ${address.street}<br>
                ${address.full}
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        ${items.length > 0 ? `
        <div class="order-section">
          <h3>Order Items</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td><strong>${item.productName || item.name || 'N/A'}</strong></td>
                  <td>${item.quantity || 1}</td>
                  <td>$${(item.price || 0).toFixed(2)}</td>
                  <td><strong>$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="totals-section">
          <h3>Order Summary</h3>
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Tax:</span>
            <span>$${tax.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Shipping:</span>
            <span>$${shipping.toFixed(2)}</span>
          </div>
          <div class="total-row final">
            <span>Total Amount:</span>
            <span>$${total.toFixed(2)}</span>
          </div>
        </div>
        ` : ''}

        <div class="print-footer">
          <p><strong>Smart Living Tech - Professional Smart Home Solutions</strong></p>
          <p>This receipt was generated by our automated system</p>
          <p>For support: support@smartlivingtech.com | Phone: (555) 123-4567</p>
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `;
  }

  generateNetworkLogsPrintContent(logs, filters) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const levelCounts = this.getLogLevelCounts(logs);
    const categoryCounts = this.getLogCategoryCounts(logs);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Network Logs Report - ${currentDate}</title>
        ${this.printStyles}
        <style>
          @page {
            margin: 0.5in;
            size: A4;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #333;
            max-width: 8.5in;
            margin: 0 auto;
            background: white;
          }
          .report-header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 20px;
            border-radius: 8px;
          }
          .report-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            color: #1e40af;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
          }
          .report-header .company-info {
            font-size: 14px;
            color: #64748b;
            margin: 8px 0;
            font-weight: 500;
          }
          .report-header .print-date {
            font-size: 11px;
            color: #64748b;
            margin-top: 5px;
          }
          .summary-section {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .summary-section h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #1e40af;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .summary-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin: 15px 0;
          }
          .stat-item {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #1e40af;
            display: block;
            margin-bottom: 5px;
          }
          .stat-label {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          .logs-section {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .logs-section h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #1e40af;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .logs-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            font-size: 10px;
          }
          .logs-table th {
            background: #1e40af;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .logs-table td {
            padding: 6px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 9px;
            vertical-align: top;
          }
          .logs-table tr:nth-child(even) {
            background: #f8fafc;
          }
          .logs-table tr:last-child td {
            border-bottom: none;
          }
          .level-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .level-info { background: #dbeafe; color: #1e40af; }
          .level-warning { background: #fef3c7; color: #92400e; }
          .level-error { background: #fee2e2; color: #991b1b; }
          .level-critical { background: #f5c6cb; color: #721c24; }
          .level-security { background: #e2e3e5; color: #383d41; }
          .print-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #64748b;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
          }
          .print-footer p {
            margin: 3px 0;
          }
          .filter-info {
            background: #f1f5f9;
            padding: 10px;
            border-radius: 6px;
            margin: 10px 0;
            font-size: 10px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Smart Living Tech</h1>
          <div class="company-info">Network Logs Security Report</div>
          <div class="print-date">Report Generated: ${currentDate}</div>
        </div>

        <div class="summary-section">
          <h3>Report Summary</h3>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">${logs.length}</span>
              <span class="stat-label">Total Logs</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${levelCounts.error || 0}</span>
              <span class="stat-label">Errors</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${levelCounts.warning || 0}</span>
              <span class="stat-label">Warnings</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${levelCounts.critical || 0}</span>
              <span class="stat-label">Critical</span>
            </div>
          </div>
        </div>

        ${Object.keys(filters).length > 0 ? `
        <div class="filter-info">
          <strong>Applied Filters:</strong> ${Object.entries(filters).map(([key, value]) => `${key}: ${value}`).join(', ')}
        </div>
        ` : ''}

        <div class="logs-section">
          <h3>Detailed Log Entries (${logs.length} records)</h3>
          <table class="logs-table">
            <thead>
              <tr>
                <th style="width: 8%;">Log ID</th>
                <th style="width: 12%;">Timestamp</th>
                <th style="width: 8%;">Level</th>
                <th style="width: 12%;">Category</th>
                <th style="width: 15%;">Event</th>
                <th style="width: 8%;">User</th>
                <th style="width: 10%;">IP Address</th>
                <th style="width: 6%;">Status</th>
                <th style="width: 8%;">Response</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td style="font-family: monospace; font-size: 8px;">${log.logId || 'N/A'}</td>
                  <td style="font-size: 8px;">${this.formatDateTime(log.timestamp)}</td>
                  <td>
                    <span class="level-badge level-${log.level || 'info'}">
                      ${(log.level || 'info').toUpperCase()}
                    </span>
                  </td>
                  <td style="font-size: 8px;">${log.category || 'N/A'}</td>
                  <td style="font-size: 8px;">${log.event || 'N/A'}</td>
                  <td style="font-size: 8px;">${log.userRole || 'N/A'}</td>
                  <td style="font-family: monospace; font-size: 8px;">${log.ipAddress || 'N/A'}</td>
                  <td style="font-size: 8px;">${log.statusCode || 'N/A'}</td>
                  <td style="font-size: 8px;">${log.responseTime ? `${log.responseTime}ms` : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="print-footer">
          <p><strong>Smart Living Tech - Network Security Monitoring System</strong></p>
          <p>This report was generated by our automated security monitoring system</p>
          <p>For technical support: support@smartlivingtech.com | Phone: (555) 123-4567</p>
          <p>Report contains ${logs.length} log entries from the selected time period</p>
        </div>
      </body>
      </html>
    `;
  }

  generateInstallationsListPrintContent(installations, filters) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Installations List</title>
        ${this.printStyles}
      </head>
      <body>
        <div class="print-header">
          <h1>Smart Living Tech</h1>
          <div class="company-info">Installations List</div>
          <div class="print-date">Printed on: ${currentDate}</div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Installations (${installations.length} total)</h2>
          </div>
          <div class="card-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Product</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Technician</th>
                </tr>
              </thead>
              <tbody>
                ${installations.map(installation => `
                  <tr>
                    <td>${installation.customerName || 'N/A'}</td>
                    <td>${installation.contactNumber || 'N/A'}</td>
                    <td>${installation.productInstalled || 
                      (installation.order && installation.order.items && installation.order.items.length > 0 ? 
                        installation.order.items.map(item => item.name || 'Unknown Product').join(', ') : 
                        'N/A')}</td>
                    <td>${this.formatDateTime(installation.installationDate)}</td>
                    <td>
                      <span class="status-badge status-${installation.status || 'pending'}">
                        ${(installation.status || 'pending').toUpperCase()}
                      </span>
                    </td>
                    <td>${installation.assignedTechnician || 'Not Assigned'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="print-footer">
          <p>This document was generated by Smart Living Tech Admin System</p>
          <p>For support, contact: support@smartlivingtech.com</p>
        </div>
      </body>
      </html>
    `;
  }

  generateOrdersListPrintContent(orders, filters) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Orders List</title>
        ${this.printStyles}
      </head>
      <body>
        <div class="print-header">
          <h1>Smart Living Tech</h1>
          <div class="company-info">Orders List</div>
          <div class="print-date">Printed on: ${currentDate}</div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Orders (${orders.length} total)</h2>
          </div>
          <div class="card-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${orders.map(order => `
                  <tr>
                    <td>${order.orderNumber || order.id || 'N/A'}</td>
                    <td>${order.customerName || order.customer?.name || 'N/A'}</td>
                    <td>${this.formatDateTime(order.orderDate || order.createdAt)}</td>
                    <td>$${(order.total || 0).toFixed(2)}</td>
                    <td>
                      <span class="status-badge status-${order.status || 'pending'}">
                        ${(order.status || 'pending').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="print-footer">
          <p>This document was generated by Smart Living Tech Admin System</p>
          <p>For support, contact: support@smartlivingtech.com</p>
        </div>
      </body>
      </html>
    `;
  }

  printContent(content, title = 'Print Document') {
    try {
      console.log('PrintUtils.printContent called with title:', title);
      console.log('Content preview:', content.substring(0, 200) + '...');
      
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      if (!printWindow) {
        alert('Please allow popups to print receipts.');
        return;
      }

      printWindow.document.write(content);
      printWindow.document.close();

      printWindow.onload = () => {
        console.log('Print window loaded, triggering print dialog...');
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
            
            setTimeout(() => {
              printWindow.close();
            }, 2000);
          } catch (printError) {
            console.error('Print error:', printError);
            
            printWindow.focus();
          }
        }, 500);
      };

      setTimeout(() => {
        if (printWindow.document.readyState === 'complete') {
          console.log('Fallback: Print window ready, triggering print...');
          try {
            printWindow.focus();
            printWindow.print();
            setTimeout(() => {
              printWindow.close();
            }, 2000);
          } catch (printError) {
            console.error('Fallback print error:', printError);
            printWindow.focus();
          }
        }
      }, 1000);

    } catch (error) {
      console.error('Error in printContent:', error);
      alert('Failed to open print window: ' + error.message);
    }
  }

  formatDateTime(dateTime) {
    if (!dateTime) return 'N/A';
    
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatAddress(addressObj, type = 'installation') {
    if (!addressObj) {
      return {
        street: 'N/A',
        city: '',
        state: '',
        zipCode: '',
        full: 'N/A'
      };
    }

    let street, city, state, zipCode;

    if (type === 'installation') {
      street = addressObj.streetAddress || addressObj.address || 'N/A';
      city = addressObj.city || '';
      state = addressObj.state || '';
      zipCode = addressObj.zipCode || '';
    } else { 
      street = addressObj.street || addressObj.address || 'N/A';
      city = addressObj.city || '';
      state = addressObj.state || '';
      zipCode = addressObj.zipCode || '';
    }

    const full = city && state ? `${city}, ${state} ${zipCode}`.trim() : '';

    return {
      street,
      city,
      state,
      zipCode,
      full
    };
  }

  getLogLevelCounts(logs) {
    const counts = {};
    logs.forEach(log => {
      const level = log.level || 'info';
      counts[level] = (counts[level] || 0) + 1;
    });
    return counts;
  }

  getLogCategoryCounts(logs) {
    const counts = {};
    logs.forEach(log => {
      const category = log.category || 'unknown';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }
}

window.PrintUtils = new PrintUtils();

window.testPrintUtils = function() {
  console.log('PrintUtils available:', !!window.PrintUtils);
  
  const testInstallation = {
    id: 'TEST-001',
    customerName: 'John Doe',
    contactNumber: '(555) 123-4567',
    customerEmail: 'john.doe@example.com',
    streetAddress: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
    productInstalled: 'Smart Thermostat Pro',
    installationDate: new Date().toISOString(),
    status: 'pending',
    assignedTechnician: 'Mike Johnson',
    notes: 'Customer prefers morning installation'
  };
  
  console.log('Testing with sample data:', testInstallation);
  window.PrintUtils.printInstallation(testInstallation);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrintUtils;
}
