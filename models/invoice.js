const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  EmpId:{
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
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
  paymentInstallment: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  paidAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  bank: {
    type: DataTypes.STRING,
    allowNull:true
  },
  modified_by: {
    type: DataTypes.STRING
  },
}, {
  tableName: 'pumo_invoices',
  timestamps: true,
  updatedAt: false,     // Disable updatedAt column

});

// Hook to increment `paymentInstallment` on update
Invoice.beforeUpdate((invoice, options) => {
  invoice.paymentInstallment += 1;
});

module.exports = Invoice;