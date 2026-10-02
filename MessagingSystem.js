/**
 * MessagingSystem Class
 * نظام الرسائل والإشعارات الفوري المدمج
 */
class MessagingSystem {
  constructor(options = {}) {
    // 1. جلب المستخدم من الجلسة الحالية بنفس المفتاح الموجود لديك
    const sessionUser = JSON.parse(sessionStorage.getItem("user"));
    if (!sessionUser) {
      console.warn("MessagingSystem: لم يتم العثور على بيانات المستخدم في sessionStorage");
      return;
    }

    this.user = {
      id: sessionUser.id,
      name: sessionUser.name || sessionUser.username || 'مستخدم',
      role: sessionUser.role || 'employee'
    };

    // إعدادات الإتصال بـ Supabase
    this.url = options.url || 'https://cqmhpvaaaduqbhjtyrgk.supabase.co/rest/v1/';
    this.key = options.key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhwdmFhYWR1cWJoanR5cmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTA3OTUsImV4cCI6MjA5NDE4Njc5NX0.eqZ69jTSRFvPhjSVx2KZe9-3LSw0cw8uAQ6D06ZkQFg';
    this.tz = 'Africa/Cairo';

    this.roleMap = {
      employee: 'الموظفون',
      admin: 'مدير النظام',
      it: 'تقنية المعلومات',
      admin_hr: 'مدير الموارد البشرية',
      hr: 'الموارد البشرية',
      sis: 'إدارة نظم معلومات الطلاب',
      admin_sis: 'مدير نظم معلومات الطلاب',
      accounts_employee: 'موظفو الحسابات',
      accounts: 'الحسابات',
      accounts_admin: 'مدير الحسابات'
    };

    // حالة التطبيق الداخلية
    this.state = {
      msgs: [],
      reps: [],
      reads: new Set(),
      secs: [],
      sec: '',
      unreadTotal: 0
    };

    this.dt = new Intl.DateTimeFormat('ar-EG', { timeZone: this.tz, dateStyle: 'medium', timeStyle: 'short' });
    this.dd = new Intl.DateTimeFormat('ar-EG', { timeZone: this.tz, dateStyle: 'full' });

    this.init();
  }

  async init() {
    this.injectStyles();
    this.createWidgetDOM();
    await this.loadAll();
    this.render();
    this.setupRealtimeNotification(); // تفعيل الإشعارات الفورية
  }

  // دعم الدعم الأساسي للبرمجة الحرة وصياغة الأدوار
  rl(r) { return r ? (this.roleMap[r] || r) : 'بدون صلاحية'; }
  secLabel(k) { return k === 'all' ? 'رسائل للجميع' : 'رسائل ' + this.rl(k); }
  isAdmin() { return this.user.role === 'admin'; }
  isGen() { return !this.user.role || this.user.role === 'employee'; }
  inSec(m, k) {
    const a = m.target_roles.includes('all');
    if (k === 'all') return a;
    return this.isAdmin() ? m.target_roles.includes(k) : !a;
  }
  esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  fd(t) { return t ? this.dt.format(new Date(t)) : '-'; }
  fday(t) { return t ? this.dd.format(new Date(t)) : ''; }
  dkey(t) { return new Date(t).toLocaleDateString('en-CA', { timeZone: this.tz }); }

  async api(p, o = {}) {
    const r = await fetch(this.url + p, {
      ...o,
      headers: {
        apikey: this.key,
        Authorization: 'Bearer ' + this.key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(o.headers || {})
      }
    });
    const t = await r.text();
    if (!r.ok) throw new Error(t);
    return t ? JSON.parse(t) : null;
  }

  // إدراج أنماط CSS المخصصة للـ Widget
  injectStyles() {
    if (document.getElementById('msg-system-styles')) return;
    const style = document.createElement('style');
    style.id = 'msg-system-styles';
    style.textContent = `
      :root { --msg-pri: #0e7c86; --msg-pri2: #0a5560; --msg-bg: #eef2f6; --msg-card: #fff; --msg-ink: #0d1b2a; --msg-mut: #64748b; --msg-line: #e3e9f0; --msg-bad: #dc2626; }
      
      /* أزرار الإشعار العائمة */
      .msg-trigger-btn {
        position: fixed; bottom: 24px; left: 24px; z-index: 9998;
        background: linear-gradient(135deg, var(--msg-pri), var(--msg-pri2));
        color: #fff; border: 0; width: 56px; height: 56px; border-radius: 50%;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2); cursor: pointer; display: flex;
        align-items: center; justify-content: center; font-size: 24px; transition: transform 0.2s;
      }
      .msg-trigger-btn:hover { transform: scale(1.08); }
      .msg-badge {
        position: absolute; top: -2px; right: -2px; background: var(--msg-bad);
        color: #fff; font-size: 11px; font-weight: bold; border-radius: 10px;
        padding: 2px 7px; border: 2px solid #fff; display: none;
      }
      .msg-badge.active { display: inline-block; }

      /* النافذة المنبثقة */
      .msg-modal-overlay {
        position: fixed; inset: 0; background: rgba(10, 22, 38, 0.5); backdrop-filter: blur(4px);
        display: none; z-index: 9999; justify-content: flex-end; direction: rtl;
        font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif;
      }
      .msg-modal-overlay.show { display: flex; }
      .msg-drawer {
        background: var(--msg-bg); width: min(650px, 100%); height: 100%;
        display: flex; flex-direction: column; box-shadow: -5px 0 25px rgba(0,0,0,0.15);
      }
      .msg-header { background: linear-gradient(135deg, #0a1626, #0d2a3b); color: #fff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
      .msg-header h3 { margin: 0; font-size: 18px; }
      .msg-header p { margin: 2px 0 0; color: #a9bccb; font-size: 12px; }
      .msg-close-btn { background: rgba(255,255,255,0.15); border: 0; color: #fff; padding: 6px 14px; border-radius: 8px; cursor: pointer; }
      
      .msg-body { flex: 1; overflow-y: auto; padding: 18px; }
      .msg-box { background: var(--msg-card); border-radius: 14px; padding: 14px 18px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .msg-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
      .msg-chip { border: 1px solid var(--msg-line); background: #fff; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; }
      .msg-chip.on { background: var(--msg-ink); color: #fff; border-color: var(--msg-ink); }
      .msg-chip i { font-style: normal; background: var(--msg-bad); color: #fff; border-radius: 10px; padding: 0 6px; font-size: 11px; margin-right: 4px; }
      
      .msg-card-item { background: #fff; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; cursor: pointer; display: flex; gap: 10px; border-right: 4px solid transparent; transition: 0.15s; }
      .msg-card-item:hover { background: #f8fafc; }
      .msg-card-item.un { border-right-color: var(--msg-pri); background: #f4fafb; font-weight: bold; }
      .msg-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--msg-pri); margin-top: 6px; }
      .msg-dot.read { background: #cbd5e1; }
      
      .msg-pv { color: #475569; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .msg-dayh { margin: 16px 0 8px; font-weight: bold; color: var(--msg-pri2); font-size: 13px; display: flex; gap: 8px; align-items: center; }
      .msg-dayh:after { content: ""; flex: 1; height: 1px; background: var(--msg-line); }

      .msg-panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: none; z-index: 10000; justify-content: center; align-items: center; padding: 15px; }
      .msg-panel-overlay.show { display: flex; }
      .msg-detail-panel { background: #fff; border-radius: 16px; max-width: 550px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 20px; direction: rtl; }
      
      .msg-btn { background: linear-gradient(135deg, var(--msg-pri), var(--msg-pri2)); color: #fff; border: 0; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: inherit; }
      .msg-btn.l { background: #f1f5f9; color: var(--msg-ink); border: 1px solid var(--msg-line); }
      .msg-rep { background: #f1f5f9; border-radius: 8px; padding: 8px 12px; margin: 6px 0; font-size: 13px; }
      .msg-rep.me { background: #e3f4f5; }
      .msg-input { width: 100%; padding: 8px 12px; border: 1px solid var(--msg-line); border-radius: 8px; margin-top: 8px; font-family: inherit; }
    `;
    document.head.appendChild(style);
  }

  // بناء أجزاء الواجهة الـ DOM
  createWidgetDOM() {
    // زر الإشعارات العائم
    const btn = document.createElement('button');
    btn.className = 'msg-trigger-btn';
    btn.innerHTML = `💬 <span class="msg-badge" id="msgGlobalBadge">0</span>`;
    btn.onclick = () => this.toggleModal(true);
    document.body.appendChild(btn);

    // النافذة الرئيسية Drawer
    const overlay = document.createElement('div');
    overlay.className = 'msg-modal-overlay';
    overlay.id = 'msgModalOverlay';
    overlay.onclick = (e) => { if (e.target === overlay) this.toggleModal(false); };

    overlay.innerHTML = `
      <div class="msg-drawer">
        <div class="msg-header">
          <div>
            <h3>صندوق الرسائل</h3>
            <p>${this.esc(this.user.name)} • ${this.esc(this.rl(this.user.role))}</p>
          </div>
          <button class="msg-close-btn" onclick="window._msgSystemInstance.toggleModal(false)">إغلاق ✕</button>
        </div>
        <div class="msg-body" id="msgDrawerBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // تفاصيل الرسالة منبثقة Sub-Panel
    const panelOv = document.createElement('div');
    panelOv.className = 'msg-panel-overlay';
    panelOv.id = 'msgDetailOverlay';
    panelOv.onclick = (e) => { if (e.target === panelOv) this.closeDetail(); };
    panelOv.innerHTML = `<div class="msg-detail-panel" id="msgDetailContent"></div>`;
    document.body.appendChild(panelOv);

    window._msgSystemInstance = this;
  }

  toggleModal(show) {
    const el = document.getElementById('msgModalOverlay');
    if (show) el.classList.add('show');
    else el.classList.remove('show');
  }

  closeDetail() {
    document.getElementById('msgDetailOverlay').classList.remove('show');
  }

  async loadAll() {
    const roles = this.isGen() ? ['all'] : ['all', this.user.role];
    this.state.msgs = await this.api('messages?select=*&order=created_at.desc&limit=500' + 
      (this.isAdmin() ? '' : '&target_roles=ov.' + encodeURIComponent('{' + roles.join(',') + '}')));

    const ids = this.state.msgs.map(m => m.id);
    if (ids.length) {
      const [rp, rd] = await Promise.all([
        this.api('message_replies?select=*&order=created_at.asc&message_id=in.(' + ids.join(',') + ')'),
        this.api('message_reads?select=message_id&user_id=eq.' + this.user.id)
      ]);
      this.state.reps = rp;
      this.state.reads = new Set(rd.map(x => x.message_id));
    } else {
      this.state.reps = [];
      this.state.reads = new Set();
    }

    if (this.isAdmin()) {
      const s = new Set(['all']);
      this.state.msgs.forEach(m => m.target_roles.forEach(r => s.add(r)));
      this.state.secs = [...s];
    } else {
      this.state.secs = this.isGen() ? ['all'] : [this.user.role, 'all'];
    }

    if (!this.state.secs.includes(this.state.sec)) {
      this.state.sec = this.state.secs[0];
    }

    this.updateGlobalBadge();
  }

  updateGlobalBadge() {
    const unreadCount = this.state.msgs.filter(m => !this.state.reads.has(m.id)).length;
    const badge = document.getElementById('msgGlobalBadge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.classList.toggle('active', unreadCount > 0);
    }
  }

  render() {
    const list = this.state.msgs.filter(m => this.inSec(m, this.state.sec));
    const un = k => this.state.msgs.filter(m => this.inSec(m, k) && !this.state.reads.has(m.id)).length;

    let html = `<div class="msg-bar">
      ${this.state.secs.map(k => `
        <button class="msg-chip ${this.state.sec === k ? 'on' : ''}" onclick="window._msgSystemInstance.setSection('${this.esc(k)}')">
          ${this.esc(this.secLabel(k))}${un(k) ? `<i>${un(k)}</i>` : ''}
        </button>
      `).join('')}
    </div>`;

    const gr = {};
    list.forEach(m => (gr[this.dkey(m.created_at)] ??= []).push(m));

    const keys = Object.keys(gr).sort().reverse();
    if (keys.length === 0) {
      html += `<div class="msg-box" style="color:var(--msg-mut)">لا توجد رسائل في هذا القسم.</div>`;
    } else {
      keys.forEach(k => {
        html += `<div class="msg-dayh">${this.fday(gr[k][0].created_at)}</div>`;
        gr[k].forEach(m => {
          const rd = this.state.reads.has(m.id);
          const n = this.state.reps.filter(x => x.message_id === m.id).length;
          html += `
            <div class="msg-card-item ${rd ? '' : 'un'}" onclick="window._msgSystemInstance.openMsg(${m.id})">
              <span class="msg-dot ${rd ? 'read' : ''}"></span>
              <div style="flex:1; min-width:0;">
                <div style="font-size:14px;">${this.esc(m.subject)}</div>
                <div style="font-size:12px; color:var(--msg-mut)">من: ${this.esc(m.sender_name)} • ${this.fd(m.created_at)}</div>
                <div class="msg-pv">${this.esc(m.body)}</div>
              </div>
              <span style="font-size:11px; background:#e0e9fe; color:#1d4fc4; padding:2px 8px; border-radius:10px; height:fit-content">${n} رد</span>
            </div>`;
        });
      });
    }

    document.getElementById('msgDrawerBody').innerHTML = html;
  }

  setSection(k) {
    this.state.sec = k;
    this.render();
  }

  async openMsg(id, keep) {
    const m = this.state.msgs.find(x => x.id === id);
    if (!m) return;

    if (!keep && !this.state.reads.has(id)) {
      this.state.reads.add(id);
      this.render();
      this.updateGlobalBadge();
      this.api('message_reads?on_conflict=message_id,user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ message_id: id, user_id: this.user.id })
      }).catch(() => this.state.reads.delete(id));
    }

    const rp = this.state.reps.filter(x => x.message_id === id);
    const content = document.getElementById('msgDetailContent');

    content.innerHTML = `
      <button class="msg-btn l" onclick="window._msgSystemInstance.closeDetail()">إغلاق ✕</button>
      <h3 style="margin:12px 0 4px">${this.esc(m.subject)}</h3>
      <div style="font-size:12px; color:var(--msg-mut)">من: ${this.esc(m.sender_name)} • ${this.fd(m.created_at)}</div>
      
      <div class="msg-box" style="white-space:pre-wrap; margin-top:12px; font-size:14px">${this.esc(m.body)}</div>
      
      <div class="msg-box">
        <h4 style="margin:0 0 8px">الردود (${rp.length})</h4>
        ${rp.map(r => `
          <div class="msg-rep ${r.user_id === this.user.id ? 'me' : ''}">
            <b>${this.esc(r.user_name)}</b> <span style="font-size:11px; color:var(--msg-mut)">${this.fd(r.created_at)}</span><br>${this.esc(r.body)}
          </div>
        `).join('') || '<span style="font-size:12px; color:var(--msg-mut)">لا توجد ردود بعد</span>'}
        
        <textarea id="msgReplyText" class="msg-input" placeholder="اكتب ردك هنا..." rows="3"></textarea>
        <button class="msg-btn" id="msgReplyBtn" style="margin-top:8px" onclick="window._msgSystemInstance.sendReply(${id})">إرسال الرد</button>
      </div>
    `;

    document.getElementById('msgDetailOverlay').classList.add('show');
  }

  async sendReply(id) {
    const input = document.getElementById('msgReplyText');
    const btn = document.getElementById('msgReplyBtn');
    const body = input.value.trim();
    if (!body) return;

    btn.disabled = true;
    try {
      const r = await this.api('message_replies', {
        method: 'POST',
        body: JSON.stringify({
          message_id: id,
          user_id: this.user.id,
          user_name: this.user.name,
          body: body
        })
      });
      this.state.reps.push(...r);
      this.render();
      this.openMsg(id, true);
    } catch (e) {
      alert('تعذر إرسال الرد: ' + e.message);
      btn.disabled = false;
    }
  }

  // ميزة الإشعار والتحديث التلقائي الدوري (Polling)
  setupRealtimeNotification() {
    setInterval(async () => {
      try {
        await this.loadAll();
        this.render();
      } catch (e) {
        console.error('تحديث الرسائل التلقائي فشل:', e);
      }
    }, 30000); // تحديث كل 30 ثانية تلقائياً
  }
}