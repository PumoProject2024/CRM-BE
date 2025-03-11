const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  receipt_no: {
    type: DataTypes.STRING,
    allowNull: false
  },
  registrationPaymentMode: {
    type: DataTypes.STRING
  },
  registrationReferenceNo: {
    type: DataTypes.STRING
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  cgst: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  sgst: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  feescollected: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentInstallment: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  pendingFees: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  pendingFeesDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'pumo_invoices',
  timestamps: true
});

// Hook to increment `paymentInstallment` on update
Invoice.beforeUpdate((invoice, options) => {
  invoice.paymentInstallment += 1;
});

module.exports = Invoice;
