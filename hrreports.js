// ==========================================
// 1. إعدادات الاتصال المباشر بـ Supabase
// ==========================================
const SUPABASE_URL = "https://cqmhpvaaaduqbhjtyrgk.supabase.co/rest/v1/";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhwdmFhYWR1cWJoanR5cmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTA3OTUsImV4cCI6MjA5NDE4Njc5NX0.eqZ69jTSRFvPhjSVx2KZe9-3LSw0cw8uAQ6D06ZkQFg";

const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

// ==========================================
// 2. فحص الحماية
// ==========================================
let user = JSON.parse(sessionStorage.getItem("user"));

const userRole = (user?.role || "").toLowerCase();
const userJob = (user?.job_title || "").toLowerCase();

const isAuthorized = user && (
    userRole === "hr" || 
    userRole === "hradmin" || 
    userJob.includes("شؤون عاملين") || 
    userJob.includes("شؤون موظفين")
);

if (!isAuthorized) {
    logout();
}

function logout() {
    window.location.replace("hr_employee.html");
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// 3. إدارة التقرير والتصدير
// ==========================================
class ReportsManager {
    constructor(currentUser) {
        this.currentUser = currentUser;
        this.currentData = [];
        this.init();
    }

    async init() {
        const reportsContainer = document.getElementById("reportsMainContainer");
        if (reportsContainer) {
            reportsContainer.style.display = "block";
        }

        const welcomeUserEl = document.getElementById("welcomeUser");
        if (welcomeUserEl && this.currentUser?.name) {
            welcomeUserEl.innerText = `مرحباً، ${this.currentUser.name}`;
        }

        await this.fetchReports();
    }

    async fetchReports() {
        const tableBody = document.getElementById("reportsTableBody");
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">جاري تحميل البيانات...</td></tr>`;
        }

        const status = document.getElementById("statusFilter")?.value || "all";
        const dateFrom = document.getElementById("dateFrom")?.value;
        const dateTo = document.getElementById("dateTo")?.value;

        // 🟢 الإسلاح هنا: استعلام جلب بيانات العميد ومقدم الطلب معاً عبر المفاتيح الأجنبية
        let selectQuery = "select=id,title,description,location,faculty,status,hr_response,created_at,created_by:users!approval_tickets_created_by_fkey(name),dean:users!approval_tickets_dean_id_fkey(name)";

        let queryParts = [
            selectQuery,
            "order=created_at.desc"
        ];

        if (status !== "all") {
            queryParts.push(`status=eq.${status}`);
        }

        if (dateFrom) {
            queryParts.push(`created_at=gte.${dateFrom}T00:00:00`);
        }
        if (dateTo) {
            queryParts.push(`created_at=lte.${dateTo}T23:59:59`);
        }

        const queryString = queryParts.join("&");
        const fullRequestUrl = `${SUPABASE_URL}approval_tickets?${queryString}`;

        try {
            const response = await fetch(fullRequestUrl, { headers });
            
            if (!response.ok) {
                throw new Error(`خطأ في استجابة الخادم: ${response.status}`);
            }

            const tickets = await response.json();

            this.currentData = tickets || [];
            this.renderTable(this.currentData);
            this.updatePdfDateRangeText(dateFrom, dateTo);

        } catch (ex) {
            console.error("خطأ أثناء جلب التقارير:", ex);
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">حدث خطأ أثناء جلب البيانات.</td></tr>`;
            }
        }
    }

    renderTable(tickets) {
        const tableBody = document.getElementById("reportsTableBody");
        if (!tableBody) return;

        if (!tickets || tickets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#000;">لا توجد بيانات مطابقة لخيارات البحث.</td></tr>`;
            return;
        }

        tableBody.innerHTML = tickets.map((ticket, index) => {
            const creatorName = ticket.created_by?.name || "غير معروف";
            const dateStr = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString("ar-EG") : '—';
            
            let statusAr = "";
            switch (ticket.status) {
                case 'pending_dean': statusAr = 'غير معتمدة (بانتظار العميد)'; break;
                case 'approved_by_dean': statusAr = 'تم الاعتماد (بانتظار HR)'; break;
                case 'completed_by_hr': statusAr = 'تم الإغلاق (رد HR)'; break;
                case 'rejected_by_dean': statusAr = 'مرفوضة من العميد'; break;
                default: statusAr = ticket.status || '—';
            }

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(creatorName)}</strong></td>
                    <td>${escapeHtml(this.formatFacultyName(ticket.faculty))}</td>
                    <td><strong>${escapeHtml(ticket.title)}</strong></td>
                    <td>${escapeHtml(ticket.description || '—')}</td>
                    <td>${escapeHtml(ticket.location || '—')}</td>
                    <td>${escapeHtml(statusAr)}</td>
                    <td>${escapeHtml(ticket.hr_response || '—')}</td>
                    <td>${dateStr}</td>
                </tr>
            `;
        }).join("");
    }

    updatePdfDateRangeText(dateFrom, dateTo) {
        const pdfDateText = document.getElementById("pdfDateRangeStr");
        if (!pdfDateText) return;

        if (dateFrom && dateTo) {
            pdfDateText.innerText = `الفترة من: ${dateFrom} إلى: ${dateTo}`;
        } else if (dateFrom) {
            pdfDateText.innerText = `ابتداءً من تاريخ: ${dateFrom}`;
        } else if (dateTo) {
            pdfDateText.innerText = `حتى تاريخ: ${dateTo}`;
        } else {
            pdfDateText.innerText = `الفترة: جميع الأوقات`;
        }
    }

    // دالة تحويل اسم الكلية من الإنجليزية إلى العربية
    formatFacultyName(facultyKey) {
        if (!facultyKey) return '—';
        
        const facultyMap = {
            'pharmacy': 'الصيدلة',
            'computer_science': 'الحاسبات والمعلومات',
            'physical_therapy': 'العلاج الطبيعي',
            'management': 'الإدارة والاقتصاد الدولي',
            'dentistry': 'طب الأسنان'
        };

        const cleanKey = String(facultyKey).trim().toLowerCase();
        return facultyMap[cleanKey] || facultyKey;
    }

    exportToPDF() {
        if (!this.currentData || this.currentData.length === 0) {
            alert("لا توجد بيانات لطباعتها.");
            return;
        }

        let modal = document.getElementById("pdfFieldsModal");
        if (modal) modal.remove();

        modal = document.createElement("div");
        modal.id = "pdfFieldsModal";
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px);
            display: flex; align-items: center; justify-content: center;
            z-index: 99999; direction: rtl; font-family: inherit;
        `;

        modal.innerHTML = `
            <div style="background: #1e293b; color: #fff; padding: 25px; border-radius: 16px; width: 90%; max-width: 520px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid rgba(255,211,105,0.2);">
                <h3 style="margin-top: 0; color: #ffd369; font-size: 20px; text-align: center; margin-bottom: 15px;">اختر الحقول المراد إظهارها في التقرير</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 15px;">
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="index" checked> الرقم</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="creator" checked> مقدم الطلب</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="faculty" checked> الكلية</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="title" checked> عنوان الطلب</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="description" checked> الوصف</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="location" checked> المكان</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="dean" checked> العميد المعتمد</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="status" checked> الحالة</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="hr_response" checked> رد شؤون العاملين</label>
                    <label style="cursor:pointer;"><input type="checkbox" class="pdf-field-cb" value="created_at" checked> تاريخ الطلب</label>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelPdfBtn" style="background: #64748b; color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: bold;">إلغاء</button>
                    <button id="confirmPdfBtn" style="background: linear-gradient(135deg, #ffd369, #e6b800); color: #1a1a1a; border: none; padding: 10px 22px; border-radius: 8px; cursor: pointer; font-weight: bold;">معاينة وطباعة</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById("cancelPdfBtn").onclick = () => modal.remove();

        document.getElementById("confirmPdfBtn").onclick = () => {
            const selectedFields = Array.from(document.querySelectorAll(".pdf-field-cb:checked")).map(cb => cb.value);
            
            if (selectedFields.length === 0) {
                alert("يرجى اختيار حقل واحد على الأقل للطباعة!");
                return;
            }

            modal.remove();
            this.generateAndPrintReport(selectedFields);
        };
    }

    generateAndPrintReport(selectedFields) {
        const logoImgSrc = document.querySelector(".logo")?.src || "logo.png";

        const fieldMap = {
            "index": "م",
            "creator": "مقدم الطلب",
            "faculty": "الكلية",
            "title": "عنوان الطلب",
            "description": "الوصف",
            "location": "المكان",
            "dean": "العميد المعتمد",
            "status": "الحالة",
            "hr_response": "رد شؤون العاملين",
            "created_at": "تاريخ الطلب"
        };

        let tableHeaders = selectedFields.map(f => `<th style="border: 1px solid #475569; padding: 8px; background: #0f172a; color: #ffd369;">${fieldMap[f]}</th>`).join("");

        let tableRows = this.currentData.map((ticket, idx) => {
            let statusAr = "";
            switch (ticket.status) {
                case 'pending_dean': statusAr = 'غير معتمدة (بانتظار العميد)'; break;
                case 'approved_by_dean': statusAr = 'تم الاعتماد (بانتظار HR)'; break;
                case 'completed_by_hr': statusAr = 'تم الإغلاق (رد HR)'; break;
                case 'rejected_by_dean': statusAr = 'مرفوضة من العميد'; break;
                default: statusAr = ticket.status || '—';
            }

            // قراءة اسم العميد من العلاقة المجلوبة
            let deanName = ticket.dean?.name ? ` ${ticket.dean.name}` : '—';

            let rowCells = selectedFields.map(f => {
                let val = "";
                switch (f) {
                    case "index": val = idx + 1; break;
                    case "creator": val = ticket.created_by?.name || "غير معروف"; break;
                    case "faculty": val = this.formatFacultyName(ticket.faculty); break;
                    case "title": val = ticket.title || '—'; break;
                    case "description": val = ticket.description || '—'; break;
                    case "location": val = ticket.location || '—'; break;
                    case "dean": val = deanName; break;
                    case "status": val = statusAr; break;
                    case "hr_response": val = ticket.hr_response || '—'; break;
                    case "created_at": val = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString("ar-EG") : '—'; break;
                }
                return `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #1e293b;">${val}</td>`;
            }).join("");

            return `<tr>${rowCells}</tr>`;
        }).join("");

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>تقرير طلبات الاعتماد</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 15mm 10mm 25mm 10mm;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 0;
                        direction: rtl;
                    }
                    .report-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 12px;
                    }
                    .report-header-text {
                        flex-grow: 1;
                        text-align: center;
                    }
                    .report-header h2 {
                        margin: 0;
                        color: #0f172a;
                        font-size: 22px;
                    }
                    .report-header p {
                        margin: 5px 0 0 0;
                        color: #64748b;
                        font-size: 13px;
                    }
                    .univ-logo {
                        width: 70px;
                        height: 70px;
                        object-fit: contain;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                        margin-bottom: 20px;
                    }
                    .footer-space {
                        height: 80px;
                    }
                    .signature-footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 70px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        border-top: 1px solid #cbd5e1;
                        padding-top: 10px;
                        background: #fff;
                    }
                    .sig-box {
                        text-align: center;
                        width: 250px;
                        font-size: 14px;
                        font-weight: bold;
                        color: #0f172a;
                    }
                    .sig-space {
                        margin-top: 35px;
                        border-bottom: 1px dashed #94a3b8;
                        width: 80%;
                        margin-left: auto;
                        margin-right: auto;
                    }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <img src="${logoImgSrc}" alt="شعار الجامعة" class="univ-logo">
                    
                    <div class="report-header-text">
                        <h2>تقرير طلبات الاعتماد </h2>
                        <p>تاريخ الاستخراج: ${new Date().toLocaleDateString("ar-EG")} - الساعة: ${new Date().toLocaleTimeString("ar-EG")}</p>
                    </div>

                    <div style="width: 70px;"></div>
                </div>

                <table>
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <div class="footer-space"></div>

                <div class="signature-footer">
                    <div class="sig-box">
                        <span>تاريخ الاعتماد: .... / .... / ........</span>
                    </div>
                    <div class="sig-box">
                        <span>توقيع اعتماد رئيس الجامعة</span>
                        <div class="sig-space"></div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    exportToExcel() {
        if (!this.currentData || this.currentData.length === 0) {
            alert("لا توجد بيانات لتصديرها.");
            return;
        }

        const excelData = this.currentData.map((ticket, index) => {
            let statusAr = "";
            switch (ticket.status) {
                case 'pending_dean': statusAr = 'غير معتمدة (بانتظار العميد)'; break;
                case 'approved_by_dean': statusAr = 'تم الاعتماد (بانتظار HR)'; break;
                case 'completed_by_hr': statusAr = 'تم الإغلاق (رد HR)'; break;
                case 'rejected_by_dean': statusAr = 'مرفوضة من العميد'; break;
                default: statusAr = ticket.status || '—';
            }

            let deanName = ticket.dean?.name ? `أ.د/ ${ticket.dean.name}` : '—';

            return {
                "رقم": index + 1,
                "مقدم الطلب": ticket.created_by?.name || "غير معروف",
                "الكلية": this.formatFacultyName(ticket.faculty),
                "عنوان الطلب": ticket.title || '—',
                "الوصف": ticket.description || '—',
                "المكان": ticket.location || '—',
                "العميد المعتمد": deanName,
                "الحالة": statusAr,
                "رد شؤون العاملين": ticket.hr_response || '—',
                "تاريخ الطلب": ticket.created_at ? new Date(ticket.created_at).toLocaleDateString("ar-EG") : '—'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "التقارير");

        XLSX.writeFile(workbook, `تقرير_طلبات_الاعتماد_${new Date().getTime()}.xlsx`);
    }
}

// ==========================================
// 4. التشغيل
// ==========================================
let reportsManager;
document.addEventListener("DOMContentLoaded", () => {
    if (user) {
        reportsManager = new ReportsManager(user);
    }
});