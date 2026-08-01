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

        let queryParts = [
            "select=id,title,description,location,faculty,status,hr_response,created_at,created_by(name)",
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
                    <td>${escapeHtml(ticket.faculty || '—')}</td>
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

    // ==========================================
    // الحل النهائي المضمون لـ PDF: استدعاء أمر الطباعة المباشرة
    // ==========================================
    exportToPDF() {
        if (!this.currentData || this.currentData.length === 0) {
            alert("لا توجد بيانات لطباعتها.");
            return;
        }

        // عند الضغط على تصدير PDF يفتح المتصفح شاشة حفظ PDF مباشرة بنص عربي سليم 100%
        window.print();
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

            return {
                "رقم": index + 1,
                "مقدم الطلب": ticket.created_by?.name || "غير معروف",
                "الكلية": ticket.faculty || '—',
                "عنوان الطلب": ticket.title || '—',
                "الوصف": ticket.description || '—',
                "المكان": ticket.location || '—',
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