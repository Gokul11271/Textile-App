const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'components', 'Billing.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Replace formatDate
const oldFormatDate = `  const formatDate = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return \`\${day}-\${month}-\${year}\`;
  };`;

const newFormatDate = `  const formatDate = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return \`\${year}-\${month}-\${day}\`;
  };`;

// 2. Replace date input
const oldDateInput = `              <div>
                <label className={labelBase}>Date</label>
                <input
                  type="text"
                  ref={dateRef}
                  value={billData.date}
                  onChange={e => setBillData({ ...billData, date: e.target.value.toUpperCase() })}
                  onKeyDown={e => e.key === 'Enter' && partyNameRef.current?.focus()}
                  className={\`\${inputBase} font-mono\`}
                  placeholder="DD-MMM-YYYY"
                />
              </div>`;

const newDateInput = `              <div>
                <label className={labelBase}>Date</label>
                <input
                  type="date"
                  ref={dateRef}
                  value={billData.date}
                  onChange={e => setBillData({ ...billData, date: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && partyNameRef.current?.focus()}
                  className={\`\${inputBase} font-mono\`}
                />
              </div>`;

content = content.replace(/\r\n/g, '\n');
content = content.replace(oldFormatDate.replace(/\r\n/g, '\n'), newFormatDate);
content = content.replace(oldDateInput.replace(/\r\n/g, '\n'), newDateInput);

fs.writeFileSync(file, content, 'utf8');
console.log("Billing.jsx patched successfully");
