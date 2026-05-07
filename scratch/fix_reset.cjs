const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'components', 'Parties.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix resetForm — inject setGstEntries reset before setFormData
const RESET_MARKER = "  const resetForm = () => {\r\n    setFormData({";
const RESET_FIX = "  const resetForm = () => {\r\n    setGstEntries([{ gst_number: '', is_active: true }]);\r\n    setGstError('');\r\n    setFormData({";

if (content.includes(RESET_MARKER)) {
  content = content.replace(RESET_MARKER, RESET_FIX);
  console.log('✅ resetForm fixed');
} else {
  // try LF
  const m = "  const resetForm = () => {\n    setFormData({";
  if (content.includes(m)) {
    content = content.replace(m, "  const resetForm = () => {\n    setGstEntries([{ gst_number: '', is_active: true }]);\n    setGstError('');\n    setFormData({");
    console.log('✅ resetForm fixed (LF)');
  } else {
    console.error('❌ resetForm marker not found');
  }
}

// Also ensure handleSubmit's validation check is removed (old one required gst_number)
const OLD_VALIDATE = "    if (!formData.gst_number && !formData.aadhar_number && !formData.pan_number) {\r\n      setError('At least one identification (GST, Aadhaar, or PAN) is required.');\r\n      return;\r\n    }";
const OLD_VALIDATE_LF = "    if (!formData.gst_number && !formData.aadhar_number && !formData.pan_number) {\n      setError('At least one identification (GST, Aadhaar, or PAN) is required.');\n      return;\n    }";

if (content.includes(OLD_VALIDATE)) {
  content = content.replace(OLD_VALIDATE, '    // Validation handled during gst_entries processing below');
  console.log('✅ Old GST validation removed');
} else if (content.includes(OLD_VALIDATE_LF)) {
  content = content.replace(OLD_VALIDATE_LF, '    // Validation handled during gst_entries processing below');
  console.log('✅ Old GST validation removed (LF)');
} else {
  console.log('ℹ️  Old GST validation not found (may already be removed)');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Parties.jsx resetForm patch complete');
