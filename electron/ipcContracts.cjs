const { z } = require('zod');

// Standardized IPC Response Wrapper
const ipcResponse = (data = null, error = null) => {
  if (error) {
    return { success: false, data: null, error: error.message || String(error) };
  }
  return { success: true, data, error: null };
};

const validatePayload = (schema, data) => {
  try {
    return {
      isValid: true,
      data: schema.parse(data),
      error: null
    };
  } catch (error) {
    console.error("Validation Error:", error);

    const issues = Array.isArray(error?.issues)
      ? error.issues
      : [];

    return {
      isValid: false,
      data: null,
      error: issues.length
        ? `Validation Error: ${issues.map(i => i.message).join(', ')}`
        : (error?.message || 'Unknown validation error')
    };
  }
};

// Schemas
const CustomerSchema = z.object({
  id: z.coerce.number().nullable().optional(),
  name: z.string().min(1, 'Customer name is required')
});

const PartySchema = z.object({
  id: z.coerce.number().nullable().optional(),
  customer_id: z.coerce.number({ required_error: 'Customer ID is required' }),
  short_name: z.string().min(1, 'Short name is required'),
  address: z.string().min(1, 'Address is required'),
  // gst_number = the currently ACTIVE GST (kept in sync with party_gst table)
  gst_number: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  aadhar_number: z.string().optional().nullable(),
  pan_number: z.string().optional().nullable(),
  opening_balance: z.union([z.string(), z.number()]).optional().transform(v => Number(v) || 0),
  // gst_entries: array sent from UI — [{gst_number, is_active}]
  gst_entries: z.array(z.object({
    gst_number: z.string().min(1, 'GST Number cannot be empty'),
    is_active: z.boolean().optional().default(false)
  })).min(1, 'At least one GST number is required').default([])
});

const SettingsSchema = z.record(z.any()); // Basic validation for settings object

const ProductSchema = z.object({
  id: z.coerce.number().nullable().optional(),
  size: z.string().optional().nullable(),
  name: z.string().min(1, 'Product Name is required')
});

const BillItemSchema = z.object({
  id: z.any().optional(), // Frontend ID
  size: z.string().optional().nullable(),
  productName: z.string().min(1, 'Product Name is required').or(z.literal('')),
  quantity: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  rate: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  amount: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  baleNumber: z.string().optional().nullable()
});

const BillSchema = z.object({
  billNumber: z.string().min(1, 'Bill Number is required'),
  date: z.string().min(1, 'Date is required'),
  agentId: z.union([z.string(), z.number()]).optional().nullable().transform(v => v ? Number(v) : null),
  partyId: z.number({ required_error: 'Party is required' }),
  partyName: z.string().optional(),
  partyShortName: z.string().optional(),
  partyAddress: z.string().optional(),
  partyGst: z.string().optional(),
  discountPercent: z.number().optional().default(0),
  discountAmount: z.number().optional().default(0),
  isInterState: z.boolean().optional().default(false),
  taxRate: z.number().optional().default(5),
  taxAmount: z.number().optional().default(0),
  cgstAmount: z.number().optional().default(0),
  sgstAmount: z.number().optional().default(0),
  lrNumber: z.string().optional().nullable(),
  lorryOffice: z.string().optional().nullable(),
  isBaleEnabled: z.boolean().optional().default(false),
  baleNumbers: z.array(z.string()).optional().default(['', '', '', '', '', '', '', '']),
  financialYear: z.string().optional().nullable(),
  totalAmount: z.number().optional().default(0),
  subtotal: z.number().optional().default(0)
});

const PaymentSchema = z.object({
  id: z.coerce.number().nullable().optional(),
  party_id: z.number({ required_error: 'Party ID is required' }),
  bill_id: z.coerce.number().nullable().optional(),
  amount: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  discount_amount: z.union([z.string(), z.number()]).transform(v => Number(v) || 0).optional().default(0),
  payment_mode: z.enum(['Cash', 'Online', 'Cheque']).default('Cash'),
  payment_type: z.enum(['advance', 'bill_payment', 'adjustment', 'refund']).default('bill_payment'),
  payment_date: z.string().min(1, 'Date is required'),
  reference_no: z.string().optional().nullable(),
  remarks: z.string().optional().nullable()
});

module.exports = {
  ipcResponse,
  validatePayload,
  CustomerSchema,
  PartySchema,
  SettingsSchema,
  ProductSchema,
  BillItemSchema,
  BillSchema,
  PaymentSchema
};
