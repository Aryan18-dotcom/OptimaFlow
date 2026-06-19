import mongoose from 'mongoose';
const { Schema, models, model } = mongoose 

const userSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: Number, required: true, unique: true },
  password: { type: String, required: true }, // Store hashed passwords!
  otp: { code: String, expiresAt: Date },
  refreshToken: String,
  deviceId: { type: String, default: null }, // Stores the device fingerprint
  isVerified: { type: Boolean, default: false },
  role: { type: String, require: true, default: "user" }
});

// 1. TRIP MODEL
const tripSchema = new Schema({
    id: { type: String, required: true, unique: true },
    trip_date_display: { type: String, required: true },
    sort_timestamp: { type: Number, required: true },
    vehicle_number: { type: String, required: true },
    driver_name: String,
    route_sequence: String
});

// 2. BILL MODEL
const billSchema = new Schema({
    id: { type: String, required: true, unique: true },
    trip_id: { type: String, required: true }, // Links to Trip
    date: String,
    vehicle_number: String,
    route_sequence: String,
    destination: String,
    lr_number: String,
    party_name: String,
    weight: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    freight: { type: Number, default: 0 },
    diten: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    total_extra_charge: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending Invoice', 'Invoiced'], default: 'Pending Invoice' },
    invoice_id: String
});

// 3. INVOICE MODEL
const invoiceSchema = new Schema({
    invoice_number: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    client_name: String,
    subtotal: Number,
    gst_amount: Number,
    grand_total: Number,
    bills_bundled: [String],
    status: { type: String, default: 'Generated' },
    payment_status: { type: String, default: "Pending" }
});

// 4. RESOURCE MODEL (Drivers, Trucks, Assignments)
const resourceSchema = new Schema({
    name: { type: String, required: true },
    category: { type: String, required: true }, // 'driver', 'truck', 'assignment'
    details: { type: Schema.Types.Mixed, default: {} } // Flexible JSON structure
});

// 5. SETTING MODEL
const billUISchema = new Schema({
  themeColor: { type: String, default: "#e11d48" },
  fontStyle: { type: String, default: "sans" },
  showGst: { type: Boolean, default: true },
  showSignature: { type: Boolean, default: true },
  termsText: { type: String, default: "1. All disputes are subject to local jurisdiction laws.\n2. Payments must accompany standard verified freight receipt signatures." },
  companyAddress: { type: String, default: "Ahemdabad" },
  footerNotes: { type: String, default: "" }
}, { _id: false });

const bankDetailsSchema = new Schema({
  bankName: { type: String, default: " " },
  accountHolder: { type: String, default: " " },
  accountNumber: { type: String, default: " " },
  ifscCode: { type: String, default: " " },
  branchName: { type: String, default: " " }
}, { _id: false });

const settingSchema = new Schema({
  companyName: { type: String, default: "Transport Roadways" },
  companyLogoText: { type: String, default: "TR" },
  logoImage: { type: String, default: null },
  billUI: { type: billUISchema, default: () => ({}) },
  bank_display_details: { 
    type: bankDetailsSchema, 
    default: () => ({}) 
  }
});

// Export Models
export const Trip = models.Trip || model('Trip', tripSchema);
export const Bill = models.Bill || model('Bill', billSchema);
export const Invoice = models.Invoice || model('Invoice', invoiceSchema);
export const Resource = models.Resource || model('Resource', resourceSchema);
export const Setting = models.Setting || model('Setting', settingSchema);
export const User = models.User || model('User', userSchema);