// Marshal Rentals - Main Application Logic
const state = {
  contacts: [],
  bookings: [],
  users: [],
  properties: [],
  maintenance: []
};

// --- NEW AUTH ENGINE (Replacing Demo Accounts) ---
window.platformSignup = async function(email, password, name, role) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role } }
  });
  if (error) { toast('❌ Error: ' + error.message, false); return; }
  if (data.user) {
    // Also save a record in our profiles table
    await supabase.from('profiles').insert([{ id: data.user.id, name, role, email }]);
    toast('✅ Registration successful! Please verify your email.', true);
  }
};

window.platformLogin = async function(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { toast('❌ Login failed: ' + error.message, false); return; }
  if (data.user) {
    const role = data.user.user_metadata.role;
    toast('✅ Welcome back, ' + (data.user.user_metadata.name || 'User'), true);
    // Route to correct dashboard
    if (role === 'Admin') ds('admin', 'a-dash');
    else if (role === 'Landlord') ds('landlord', 'l-overview');
    else ds('tenant', 't-overview');
  }
};

function saveState() { /* No longer needed for LocalStorage - data is now in Supabase */ }
async function loadState() {
  // Fetch real data from Supabase
  const { data: listings } = await supabase.from('listings').select('*');
  if (listings) state.properties = listings;
  renderAllDynamic();
}

// ---- ALL ACTION HANDLERS (Globally Available) ----

window.lPropAction = function (action, name) {
  let bodyHtml, btns;
  if (action === 'Edit') {
    bodyHtml = `<div style='text-align:left;display:flex;flex-direction:column;gap:12px;'>
      <div class='df'><label class='dfl'>Property Name</label><input type='text' value='${name}' style='width:100%'></div>
      <div class='df'><label class='dfl'>Rent (KSh)</label><input type='number' style='width:100%'></div>
    </div>`;
    btns = `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Property updated!", true);'>Save</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`;
  } else if (action === 'View') {
    bodyHtml = `<div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
      <p><strong>Property:</strong> ${name}</p><p><strong>Status:</strong> Occupied</p><p><strong>Rent:</strong> KSh 12,000</p>
    </div>`;
    btns = `<button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Close</button>`;
  } else {
    bodyHtml = `<p>Are you sure you want to delete <strong>${name}</strong>?</p>`;
    btns = `<button class='btn' style='flex:1;background:var(--red);color:#fff' onclick='cmsCloseModal(); toast("🗑️ Deleted", true);'>Yes, Delete</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`;
  }
  showModal(action + ' Property', bodyHtml, btns);
};

window.lSendReminder = function (type) {
  const p = document.querySelector('#sec-l-tenants');
  if (!p) { toast('Error: reminder form not found', false); return; }
  const sel = p.querySelector('select')?.value || 'Tenant';
  const msg = p.querySelector('textarea')?.value || '';
  if (type === 'wa') {
    const waUrl = 'https://wa.me/254700000000?text=' + encodeURIComponent(msg);
    showModal('Send Reminder via WhatsApp', `<p>Sending reminder to <strong>${sel}</strong>.</p>`,
      `<button class='btn bwa' style='flex:1;' onclick='window.open("${waUrl}", "_blank"); cmsCloseModal();'>Open WhatsApp</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
    );
  } else {
    toast('✅ SMS Reminder queued for ' + sel, true);
  }
};

window.lRecordPayment = function () {
  const p = document.querySelector('#sec-l-payments');
  const t = p.querySelector('select')?.value || 'Unknown';
  const a = p.querySelectorAll('input')[0]?.value || '0';
  const r = p.querySelectorAll('input')[1]?.value || '';
  if (!a || a === '0') { toast('Please enter an amount', false); return; }
  toast('✅ Payment of KSh ' + a + ' recorded for ' + t, true);
  p.querySelectorAll('input').forEach(i => i.value = '');
};

window.lViewPayment = function (id) {
  showModal('Payment Details', `<div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
      <p><strong>Payment ID:</strong> PAY-00${id}</p>
      <p><strong>Tenant:</strong> Grace Wanjiku</p>
      <p><strong>Amount:</strong> KSh 12,000</p>
      <p><strong>Method:</strong> M-Pesa</p>
      <p><strong>Date:</strong> 1 Mar 2025</p>
      <p><strong>Status:</strong> <span class='badge bg'>Paid</span></p>
    </div>`,
    `<button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Close</button>`
  );
};

window.lDelPayment = function (id) {
  showModal('Delete Payment Record', `<p>Are you sure you want to delete payment record <strong>PAY-00${id}</strong>? This cannot be undone.</p>`,
    `<button class='btn' style='flex:1;background:var(--red);color:#fff;' onclick='cmsCloseModal(); toast("🗑️ Payment record deleted.", true);'>Confirm Delete</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lViewTenant = function (name) {
  showModal('Tenant Details — ' + name,
    `<div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
      <p><strong>Name:</strong> ${name}</p><p><strong>Unit:</strong> Sunrise 3B</p><p><strong>Rent:</strong> Paid</p>
    </div>`,
    `<button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Close</button>`
  );
};

window.waTenant = function (phone, name) {
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent('Hello ' + name)}`;
  showModal('WhatsApp ' + name, `<p>Notify <strong>${name}</strong> via WhatsApp?</p>`,
    `<button class='btn bwa' style='flex:1;' onclick='window.open("${waUrl}", "_blank"); cmsCloseModal();'>Open WhatsApp</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lExportCSV = function () {
  showModal('Export CSV', '<p>Download the current view as CSV?</p>',
    `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Downloaded!", true);'>Download</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lAddProperty = function () {
  showModal('Add New Property', `<div style='text-align:left;display:flex;flex-direction:column;gap:12px;'>
      <div class='df'><label class='dfl'>Property Name</label><input type='text' placeholder='e.g. Sunrise Apts 4C' style='width:100%'></div>
      <div class='df'><label class='dfl'>Location</label><input type='text' placeholder='e.g. Naivasha' style='width:100%'></div>
      <div class='df'><label class='dfl'>Monthly Rent (KSh)</label><input type='number' placeholder='15000' style='width:100%'></div>
      <div class='df'><label class='dfl'>Property Images (Max 6)</label>
        <div id='l-prop-preview' style='display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px;'></div>
        <div style='border:2px dashed var(--g200);border-radius:var(--rsm);padding:20px;text-align:center;cursor:pointer;' onclick='document.getElementById("l-prop-img").click()'>
          <span style='font-size:24px;'>📷</span>
          <p style='font-size:12px;color:var(--g500);margin-top:5px;'>Click to upload or drag and drop</p>
          <input type='file' id='l-prop-img' multiple accept='image/*' style='display:none;' onchange='handleImagePreview(this, "l-prop-preview")'>
        </div>
      </div>
    </div>`,
    `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Property added successfully!", true);'>Add Property</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lPropBoost = function (name) {
  showModal('Boost Listing', `<p>Feature <strong>${name}</strong> at the top of search results for 7 days?</p><p style='font-size:12px;color:var(--g500);'>Cost: KSh 500</p>`,
    `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("🚀 Property Boosted!", true);'>Boost Now</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lWaAllTenants = function () {
  showModal('Broadcast to All Tenants', `<div class='df'><label class='dfl'>Broadcast Message</label><textarea placeholder='Hello everyone...' style='width:100%;height:80px;'></textarea></div>`,
    `<button class='btn bwa' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Broadcast sent via WhatsApp!", true);'>Send to All</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lMsgSend = function () {
  const ta = document.querySelector('.mcomp textarea');
  if (ta && ta.value.trim() === '') { toast('Please type a message first.', false); return; }
  toast('✅ Message sent!', true);
  if (ta) ta.value = '';
};

window.lMsgSendWa = function () {
  const ta = document.querySelector('.mcomp textarea');
  const txt = ta ? ta.value : '';
  if (txt.trim() === '') { toast('Please type a message first.', false); return; }
  const waUrl = 'https://wa.me/254700000000?text=' + encodeURIComponent(txt);
  showModal('Send via WhatsApp', `<p>This will open WhatsApp with your message pre-filled.</p>`,
    `<button class='btn bwa' style='flex:1;' onclick='window.open("${waUrl}", "_blank"); cmsCloseModal();'>Open WhatsApp</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lMaintRespond = function (issue, name) {
  showModal('Respond to ' + name, `<div class='df'><label class='dfl'>Response</label><textarea style='width:100%;height:80px;'></textarea></div>`,
    `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Response sent!", true);'>Send</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lMaintUpdateNotify = function () { toast('✅ Updated and notified!', true); };
window.lMaintWaNotify = function () { toast('Redirecting to WhatsApp...', true); };
window.lSaveProfile = function () { toast('✅ Profile saved!', true); };

window.aInviteUser = function () {
  showModal('Invite User', `<div class='df'><label class='dfl'>Email</label><input type='email' style='width:100%'></div>`,
    `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Invited!", true);'>Send Invite</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.aUserAction = function (action, name) {
  let bodyHtml, btns;
  if (action === 'Edit') {
    bodyHtml = `<div style='text-align:left;display:flex;flex-direction:column;gap:12px;'>
      <div class='df'><label class='dfl'>Full Name</label><input type='text' value='${name}' style='width:100%'></div>
      <div class='df'><label class='dfl'>Email</label><input type='email' style='width:100%'></div>
      <div class='df'><label class='dfl'>Phone</label><input type='tel' style='width:100%'></div>
    </div>`;
    btns = `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("✅ User updated!", true);'>Save</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`;
  } else if (action === 'View') {
    bodyHtml = `<div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
      <p><strong>Name:</strong> ${name}</p><p><strong>Status:</strong> Active</p><p><strong>Role:</strong> Landlord</p><p><strong>Joined:</strong> Jan 2025</p>
    </div>`;
    btns = `<button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Close</button>`;
  } else if (action === 'Verify' || action === 'Approve') {
    bodyHtml = `<p>Are you sure you want to approve/verify <strong>${name}</strong>?</p>`;
    btns = `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Approved", true);'>Approve</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`;
  } else if (action === 'Reject' || action === 'Delete' || action === 'Del') {
    bodyHtml = `<p>Are you sure you want to ${action.toLowerCase()} <strong>${name}</strong>?</p>`;
    btns = `<button class='btn' style='flex:1;background:var(--red);color:#fff' onclick='cmsCloseModal(); toast("Done", true);'>Confirm</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`;
  } else {
    bodyHtml = `<p>Apply <strong>${action}</strong> to ${name}?</p>`;
    btns = `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Done!", true);'>Confirm</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`;
  }
  showModal(action + ' ' + (name || 'User'), bodyHtml, btns);
};

window.aPropAction = function (action, name) {
  if (action === 'Approve') {
    showModal('Approve Listing', `<p>Approve <strong>${name}</strong> and make it live on the platform?</p>`,
      `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Listing is now live!", true);'>Approve</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
    );
  } else if (action === 'Reject') {
    showModal('Reject Listing', `<p>Reject <strong>${name}</strong>? Please provide a reason to the landlord.</p><textarea placeholder='Reason...' style='width:100%;min-height:80px;'></textarea>`,
      `<button class='btn' style='flex:1;background:var(--red);color:#fff;' onclick='cmsCloseModal(); toast("❌ Listing rejected", true);'>Reject</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
    );
  } else {
    window.lPropAction(action, name); // Reuse existing logic
  }
};

window.aMaintAction = function (action, id) {
  if (action === 'Assign') {
    showModal('Assign Task', `<div class='df'><label class='dfl'>Service Provider</label><select style='width:100%'><option>Naivasha Plumbers</option><option>Quick Fix Electricians</option><option>Pest Control Pros</option></select></div>`,
      `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Task assigned!", true);'>Assign</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
    );
  } else if (action === 'Update' || action === 'Edit') {
    showModal('Edit Request', `<div style='text-align:left;display:flex;flex-direction:column;gap:12px;'>
        <div class='df'><label class='dfl'>Status</label><select style='width:100%'><option>In Progress</option><option>Awaiting Parts</option><option>Resolved</option></select></div>
        <div class='df'><label class='dfl'>Urgency</label><select style='width:100%'><option>Low</option><option>Medium</option><option>High</option></select></div>
        <div class='df'><label class='dfl'>Internal Notes</label><textarea style='width:100%;height:60px;' placeholder='Maintenance notes...'></textarea></div>
      </div>`,
      `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Request updated!", true);'>Save Changes</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
    );
  } else if (action === 'View') {
    showModal('Maintenance Details', `<div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
        <p><strong>Request ID:</strong> #MT-00${id}</p>
        <p><strong>Tenant:</strong> Grace Wanjiku</p>
        <p><strong>Property:</strong> Sunrise Apartments 3B</p>
        <p><strong>Issue:</strong> Leaking tap — bathroom</p>
        <p><strong>Urgency:</strong> <span class='badge ba'>Medium</span></p>
        <p><strong>Status:</strong> <span class='badge ba'>In Progress</span></p>
        <p><strong>Reported:</strong> 15 Mar 2025</p>
      </div>`, `<button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Close</button>`);
  } else if (action === 'Delete' || action === 'Del') {
    showModal('Delete Request', `<p>Are you sure you want to delete maintenance request <strong>#MT-00${id}</strong>? This cannot be undone.</p>`,
      `<button class='btn' style='flex:1;background:var(--red);color:#fff;' onclick='cmsCloseModal(); toast("🗑️ Request deleted.", true);'>Confirm Delete</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
    );
  } else {
    showModal(action + ' Request', `<p>Apply ${action.toLowerCase()} to request #${id}?</p>`, `<button class='btn bp' onclick='cmsCloseModal(); toast("Done",true);'>Confirm</button>`);
  }
};

window.aGenerateReport = function (name) {
  showModal('Generate ' + name, `<p>Preparing data for <strong>${name}</strong>. Do you want to download as PDF or Excel?</p>`,
    `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("📥 PDF Generating...", true);'>PDF</button><button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); toast("📤 Excel Exporting...", true);'>Excel</button>`
  );
};

window.aAddListing = function () {
  showModal('New Listing', `<div style='display:flex;flex-direction:column;gap:12px;text-align:left;'>
      <div class='df'><label class='dfl'>Property Name</label><input type='text' style='width:100%'></div>
      <div class='df'><label class='dfl'>Landlord Email</label><input type='email' style='width:100%'></div>
      <div class='df'><label class='dfl'>Rent (KSh)</label><input type='number' style='width:100%'></div>
      <div class='df'><label class='dfl'>Property Images (Max 6)</label>
        <div id='a-prop-preview' style='display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px;'></div>
        <div style='border:2px dashed var(--g200);border-radius:var(--rsm);padding:20px;text-align:center;cursor:pointer;' onclick='document.getElementById("a-prop-img").click()'>
          <span style='font-size:24px;'>📷</span>
          <p style='font-size:12px;color:var(--g500);margin-top:5px;'>Click to upload or drag and drop</p>
          <input type='file' id='a-prop-img' multiple accept='image/*' style='display:none;' onchange='handleImagePreview(this, "a-prop-preview")'>
        </div>
      </div>
    </div>`,
    `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); toast("✅ New listing created!", true);'>Create</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.aResetPlatform = function () {
  showModal('RESET PLATFORM DATA?', `<p style='color:var(--red);font-weight:600;'>WARNING: This will permanently delete ALL listings, user data, and platform settings.</p><p>This action cannot be undone. Are you absolutely sure?</p>`,
    `<button class='btn' style='flex:1;background:var(--red);color:#fff;' onclick='localStorage.clear(); location.reload();'>Yes, Reset Everything</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.handleImagePreview = function (input, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const files = Array.from(input.files).slice(0, 6);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.width = '50px';
      wrapper.style.height = '50px';

      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = 'var(--rsm)';
      img.style.border = '1px solid var(--g200)';

      const delBtn = document.createElement('div');
      delBtn.innerHTML = '×';
      delBtn.style.position = 'absolute';
      delBtn.style.top = '-5px';
      delBtn.style.right = '-5px';
      delBtn.style.width = '16px';
      delBtn.style.height = '16px';
      delBtn.style.background = 'var(--red)';
      delBtn.style.color = '#fff';
      delBtn.style.borderRadius = '50%';
      delBtn.style.fontSize = '12px';
      delBtn.style.fontWeight = 'bold';
      delBtn.style.display = 'flex';
      delBtn.style.alignItems = 'center';
      delBtn.style.justifyContent = 'center';
      delBtn.style.cursor = 'pointer';
      delBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      delBtn.onclick = (event) => {
        event.stopPropagation();
        wrapper.remove();
        toast('🗑️ Image removed', true);
      };

      wrapper.appendChild(img);
      wrapper.appendChild(delBtn);
      container.appendChild(wrapper);
    };
    reader.readAsDataURL(file);
  });
  if (input.files.length > 6) toast('⚠️ Limited to top 6 images', false);
  else if (input.files.length > 0) toast('🖼️ Images selected!', true);
};

window.loadMoreProps = function (btn) {
  const old = btn.textContent;
  btn.textContent = 'Loading...';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
    toast('✅ Loaded 6 more properties!', true);
    // In a real app we would append more cards here
  }, 800);
};

window.loadMoreArticles = function (btn) {
  const old = btn.textContent;
  btn.textContent = 'Loading...';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
    toast('✅ More articles loaded!', true);
  }, 800);
};

window.lSwitchConv = function (name, initials, bg, color, unit) {
  document.querySelectorAll('.mlrow').forEach(r => r.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  const h = document.querySelector('.mheader');
  if (h) {
    const av = h.querySelector('.uav'); if (av) { av.textContent = initials; av.style.background = bg; av.style.color = color; }
    const nm = h.querySelector('[style*="font-weight:600"]'); if (nm) nm.textContent = name;
    const ut = h.querySelector('[style*="font-size:11px"]'); if (ut) ut.textContent = unit;
  }
  toast('Chat with ' + name, true);
};

window.submitMaint = function () {
  const t = document.querySelector('#sec-t-maint textarea');
  const d = t ? t.value.trim() : '';
  if (!d) { toast('Please describe the issue.', false); return; }
  toast('✅ Maintenance request submitted!', true);
  if (t) t.value = '';
};
window.attachPhoto = function () { document.getElementById('maint-photo-inp')?.click(); };
window.photoSelected = function (inp) { if (inp.files && inp.files[0]) toast('📷 Photo attached!', true); };
window.tDocUpload = function () { document.getElementById('t-doc-inp')?.click(); };
window.tDocFileSelected = function (inp) { if (inp.files && inp.files[0]) toast('📎 Document attached!', true); };

window.viewProperty = function (id) {
  showModal('Property Details', `<div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
      <p><strong>Property:</strong> Nakuru CBD · 1BR</p><p><strong>Status:</strong> Available</p><p><strong>Rent:</strong> KSh 15,000</p>
    </div>`,
    `<button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Close</button>`
  );
};

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  console.log('Marshal Rentals App Started.');
});
