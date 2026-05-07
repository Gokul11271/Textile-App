const { z } = require('zod');

// Standardized IPC Response Wrapper
const ipcResponse = (data = null, error = null) => {
  if (error) {
    return { success: false, data: null, error: error.message || String(error) };
  }
  return { success: true, data, error: null };
};

// Validation Wrapper
const validatePayload = (schema, data) => {
  try {
    const validData = schema.parse(data);
    return { isValid: true, data: validData, error: null };
  } catch (error) {
    return { 
      isValid: false, 
      data: null, 
      error: `Validation Error: ${error.errors.map(e => e.message).join(', ')}` 
    };
  }
};

// Schemas
const CustomerSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().min(1, 'Customer name is required')
});

const PartySchema = z.object({
  id: z.number().nullable().optional(),
  customer_id: z.number({ required_error: 'Customer ID is required' }),
  short_name: z.string().min(1, 'Short name is required'),
  address: z.string().min(1, 'Address is required'),
  // gst_number = the currently ACTIVE GST (kept in sync with party_gst table)
  gst_number: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  aadhar_number: z.string().optional().nullable(),
  pan_number: z.string().optional().nullable(),
  opening_balance: z.union([z.string(), z.number()]).optional().transform(v => Number(v) || 0),
  // gst_entries: array sent from UI — [{gst_number, is_active}]
  gst_entries: z.array(z.object({
    gst_number: z.string().min(1),
    is_active: z.boolean().optional().default(false)
  })).optional().default([])
}).refine(data => data.gst_number || data.aadhar_number || data.pan_number || (data.gst_entries && data.gst_entries.length > 0), {
  message: 'At least one GST, Aadhaar, or PAN is required.'
});

const SettingsSchema = z.record(z.any()); // Basic validation for settings object

const ProductSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().min(1, 'Product Name is required'),
  default_rate: z.union([z.string(), z.number()]).optional().transform(v => Number(v) || 0)
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

module.exports = {
  ipcResponse,
  validatePayload,
  CustomerSchema,
  PartySchema,
  SettingsSchema,
  ProductSchema,
  BillItemSchema,
  BillSchema
};
