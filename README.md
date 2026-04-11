# Dhanalakshmi Textiles Billing Software

A modern, fast, and feature-rich desktop billing application built specifically for Dhanalakshmi Textiles. This application streamlines the daily invoicing, reporting, and customer management processes, replacing manual paperwork with a sleek digital workflow.

## 🚀 Key Features

* **Quick Invoicing System**: Rapidly create new bills with auto-incrementing bill numbers and autocomplete for parties and items.
* **Dual Print Formats**: Automatically generate and print professional invoices in two formats:
  * **Big Print**: Standard full-sized invoice containing full taxation and discount breakdown.
  * **Transport Print**: Condensed slip formats optimized for transport handling.
* **Party Management**: Keep track of buyers, agents, and their respective details (GST, PAN, Aadhaar) securely in a local database.
* **Sales Audit & Reporting**: Robust reporting module to filter sales by date ranges, search transactions, execute batch printing, and export financial summaries to CSV for accounting.
* **Beautiful Material 3 Design**: Built with a sleek, animated, and responsive user interface adopting Google's Material 3 design system.
* **Toast Notifications**: Integrated `sonner` provides non-obtrusive, aesthetic pop-up alerts.
* **Offline First**: Entirely self-contained application using local SQLite databases. No internet connection necessary for daily billing.
* **Data Backup & Recovery**: Native settings to export database backups (e.g., to a Pendrive) and restore them seamlessly.

## 🛠️ Technology Stack

* **Frontend Framework**: React 19 + Vite 7
* **Desktop Environment**: Electron 41
* **Styling**: Tailwind CSS (customized with Material Design 3 tokens)
* **Icons**: Lucide React
* **Notifications**: Sonner
* **Database**: SQLite3 (`sqlite3` module managed by Electron)
* **PDF Generation**: jsPDF & jsPDF-AutoTable

## 🔧 Installation & Setup

1. **Clone or Download the Repository** to your local machine.
2. **Install Dependencies**:
   Open a terminal in the project root and run:
   ```bash
   npm install
   ```
   *Note: If SQLite bindings fail to build, run `npm run rebuild-sqlite` to compile them against the current Electron version.*

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   This will simultaneously launch the React Vite server and the Electron desktop wrapper.

## 📦 Building/Packaging for Production

To create a standalone setup executable (`.exe` for Windows):

```bash
npm run package
```
or 
```bash
npm run build
```

The output installation files will be placed in the `release/` directory. By default, it builds an NSIS installer targeting Windows architectures (x64 and ia32).

## 💡 Workflow Examples

- **Single Bill Workflow**: Fill in party/item information -> Hit **Save & Generate**. System will save to DB, build PDF invoices (Big & Transport), and instantly send them via IPC to your default printer.
- **Batch Processing**: Navigate to **Reports**, select start and end invoice numbers, assign an LR range, and click **Print Big Bills** to automatically manage logistics paperwork at the end of the day.

## 👥 Authors

Maintained by the IT infrastructure team for Dhanalakshmi Textiles.



# Dhanalakshmi Textiles Billing Software

A modern, fast, and secure desktop billing software built specifically for textile wholesale and retail operations. The application is built using React (Vite) for the UI, styled with Tailwind CSS, and powered by Electron with a local SQLite database for offline-first, secure operations.

## Architecture & Workflows

### Application Workflow

The following flowchart illustrates the high-level workflow from configuration to final invoice generation and printing within the application:

```mermaid
graph TD
    %% Define styles
    classDef config fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef action fill:#dcfce3,stroke:#16a34a,stroke-width:2px;
    classDef storage fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef output fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;

    Start((Start)) --> Auth[Launch Desktop App]
    
    Auth --> Settings[Configure Settings]:::config
    Auth --> Master[Manage Master Data]:::config
    
    subgraph Master Configurations
        Settings --> |Active Company Profile, Tax Rates| ST[Global App State]
        Master --> |Create/Edit| C(Customers & Parties)
        Master --> |Create/Edit| A(Agents List)
    end
    
    Auth --> Billing[Create New Bill]:::action
    
    subgraph Billing Engine
        Billing --> SelectParty[Select Party & Agent]
        Billing --> Items[Enter Grid Items: Size, Name, Qty, Rate, Bale]
        SelectParty -. Auto-fills .-> BillingData[GST, Address, Terms]
        Items --> Calc{Real-Time Calculation}
        Calc -. Subtotal, Tax, Discounts .-> Calc
    end
    
    Calc --> SaveBtn[Click Save & Generate]:::action
    
    SaveBtn --> DB[(Save to SQLite Local DB)]:::storage
    
    DB --> PDFEngine(PDF Generator - Node/jsPDF)
    
    subgraph PDF Generation
        PDFEngine --> B1[Big Bill]:::output
        PDFEngine --> B2[Transport Copy]:::output
        B1 -. Formats Numbers to Text .-> Formatting
        B2 -. Formats GST spacing .-> Formatting
    end
    
    Formatting --> PrintSync((System Printer Context))
```

---

## Database Schema Design

The entire application runs entirely locally. We use **SQLite3** to ensure fast, zero-latency database manipulation that doesn't rely on cloud hosting or network connectivity.

### ER Diagram

```mermaid
erDiagram
    CUSTOMERS ||--o{ PARTIES : has
    PARTIES ||--o{ BILLS : "billed to"
    AGENTS ||--o{ BILLS : "managed by"
    BILLS ||--o{ BILL_ITEMS : contains
    
    CUSTOMERS {
        int id PK
        string name
        datetime created_at
    }
    
    PARTIES {
        int id PK
        int customer_id FK
        string short_name
        string address
        string gst_number
        string phone
        string email
        string city
        string state
        string aadhar_number
        string pan_number
        float opening_balance
        datetime created_at
    }

    AGENTS {
        int id PK
        string name
        datetime created_at
    }

    BILLS {
        int id PK
        string bill_number UK
        string date
        int agent_id FK
        int party_id FK
        float discount_percent
        float discount_amount
        float tax_rate
        float tax_amount
        int is_inter_state "Boolean (0/1)"
        string lr_number
        string lorry_office
        int is_bale_enabled "Boolean (0/1)"
        string bale_numbers "JSON Array string"
        float total_amount
        datetime created_at
    }

    BILL_ITEMS {
        int id PK
        int bill_id FK
        string size
        string product_name
        int quantity
        float rate
        float amount
        string bale_number
    }

    SETTINGS {
        string key PK "e.g., activeCompany, company1"
        string value "JSON Stringified object"
    }
```

### Table Definitions

#### `customers`
Stores the highest-level entity for a customer grouping.
* `id` (INTEGER, PRIMARY KEY)
* `name` (TEXT, NOT NULL, UNIQUE)
* `created_at` (DATETIME)

#### `parties`
Branch/Location level details mapped directly to `customers` ID.
* `id` (INTEGER, PRIMARY KEY)
* `customer_id` (INTEGER, FOREIGN KEY)
* `short_name` (TEXT, NOT NULL) / *Unique alongside customer_id*
* `address`, `gst_number`, `phone`, `email`, `city`, `state`, `aadhar_number`, `pan_number` (TEXT)
* `opening_balance` (REAL, DEFAULT 0)
* `created_at` (DATETIME)

#### `agents`
Directory for sales representatives or agents.
* `id` (INTEGER, PRIMARY KEY)
* `name` (TEXT, NOT NULL, UNIQUE)
* `created_at` (DATETIME)

#### `bills`
Core ledger for all invoices generated.
* `id` (INTEGER, PRIMARY KEY)
* `bill_number` (TEXT, NOT NULL, UNIQUE)
* `date` (TEXT)
* `agent_id` (INTEGER, FOREIGN KEY -> `agents(id)`)
* `party_id` (INTEGER, FOREIGN KEY -> `parties(id)`)
* `discount_percent` (REAL)
* `discount_amount` (REAL)
* `tax_rate` (REAL)
* `tax_amount` (REAL)
* `is_inter_state` (INTEGER) / *Stores 1 for true, 0 for false (handles CGST+SGST vs IGST)*
* `lr_number` (TEXT)
* `lorry_office` (TEXT)
* `is_bale_enabled` (INTEGER)
* `bale_numbers` (TEXT) / *Stored as JSON representation of array*
* `total_amount` (REAL)
* `created_at` (DATETIME)

#### `bill_items`
Row-level detail referencing a parent `bills(id)`.
* `id` (INTEGER, PRIMARY KEY)
* `bill_id` (INTEGER, NOT NULL, FOREIGN KEY -> `bills(id)`)
* `size` (TEXT)
* `product_name` (TEXT, NOT NULL)
* `quantity` (INTEGER)
* `rate` (REAL)
* `amount` (REAL)
* `bale_number` (TEXT)

#### `settings`
Key-Value storage system allowing dynamic configuration modifications (Multi-Company context, print formatting, defaults) without schema disruption.
* `key` (TEXT, PRIMARY KEY)
* `value` (TEXT) / *Typically stores object graphs serialized via JSON*