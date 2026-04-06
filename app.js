// Marshal Rentals - Main Application Logic
// Using global PLATFORM_STATE to ensure UI sync
const getPlatState = () => window.PLATFORM_STATE || { contacts: [], bookings: [], users: [], properties: [], maintenance: [] };

// --- NEW AUTH ENGINE (Replacing Demo Accounts) ---
// --- NEW AUTH ENGINE (Replacing Demo Accounts) ---
window.platformResetPassword = async function () {
  const email = prompt("Enter your registered email to reset your password:");
  if (!email) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) { toast('❌ Error: ' + error.message, false); }
  else { toast('📧 Reset link sent! Please check your email.', true); }
};

window.platformLogin = async function (email, password) {
  if (!email || !password) { toast('❌ Please fill in all fields', false); return; }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Email not confirmed")) {
      toast('❌ Please check your email and verify your account first!', false);
    } else {
      toast('❌ Login failed: ' + error.message, false);
    }
    return;
  }

  if (data.user) {
    const uMeta = data.user.user_metadata || {};
    const role = (uMeta.role || 'Tenant').toLowerCase();
    const userName = uMeta.name || 'User';
    toast('\u2705 Welcome back, ' + userName, true);

    // Store globally for document/data filtering
    window.CURRENT_USER_NAME = userName;

    if (role === 'tenant') {
      // Tenant Sidebar
      const sidebarName = document.getElementById('t-sidebar-name');
      const avatar = document.getElementById('t-avatar');
      if (sidebarName) sidebarName.textContent = userName;
      if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();

      // Tenant Settings
      const nameField = document.getElementById('t-set-name');
      const emailField = document.getElementById('t-set-email');
      if (nameField) nameField.value = userName;
      if (emailField) emailField.value = data.user.email || '';
    } else if (role === 'landlord') {
      // Landlord Sidebar
      const sidebarName = document.getElementById('l-sidebar-name');
      const avatar = document.getElementById('l-avatar');
      if (sidebarName) sidebarName.textContent = userName;
      if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();

      // Landlord Settings
      const nameField = document.getElementById('l-set-name');
      const nameDisp = document.getElementById('l-set-name-display');
      const emailDisp = document.getElementById('l-set-email-display');
      if (nameField) nameField.value = userName;
      if (nameDisp) nameDisp.textContent = userName;
      if (emailDisp) emailDisp.textContent = data.user.email || '';
    }

    // Switch Page and Dashboard Section
    gto(role);
    if (role === 'admin') ds('admin', 'a-dash');
    else if (role === 'landlord') ds('landlord', 'l-overview');
    else ds('tenant', 't-overview');
  }
};

window.platformSignup = async function (email, password, name, role) {
  if (!email || !password || !name) { toast('❌ Please fill in all fields', false); return; }

  // Role-based registration enabled for Admin, Tenant, and Landlord


  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role } }
  });

  if (error) {
    if (error.message.includes("User already registered")) {
      toast('❌ This email is already taken! Please sign in or use another email.', false);
    } else {
      toast('❌ Signup Error: ' + error.message, false);
    }
    return;
  }

  if (data.user) {
    // Note: The database trigger we added in the last step handles the profile creation!
    toast('✅ Signup successful! Please check your email to verify.', true);
    setTimeout(() => gto('login'), 2500);
  }
};
// --- LANDLORD DATA ENGINE (Supabase Master Fetcher) ---

window.fetchLandlordData = async function() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const lId = user.id;

    // 1. Fetch Properties (Listings)
    const { data: props } = await supabase.from('listings').select('*').eq('landlord_id', lId);
    
    // 2. Fetch Payments for Stats
    const { data: payments } = await supabase.from('payments').select('*').eq('landlord_id', lId);
    
    // 3. Fetch Maintenance for Stats
    const { data: maint } = await supabase.from('maintenance').select('*').eq('landlord_id', lId);

    // 4. Fetch Documents
    const { data: docs } = await supabase.from('documents').select('*').eq('landlord_id', lId);

    // --- UPDATE UI STATS ---
    
    // Overview & Property Stats
    const propCount = props ? props.length : 0;
    if (document.getElementById('l-stat-props')) document.getElementById('l-stat-props').textContent = propCount;
    if (document.getElementById('l-props-count-text')) document.getElementById('l-props-count-text').textContent = `My properties (${propCount})`;

    // Tenant Stats
    const activeTenantsCount = props ? props.filter(p => p.status === 'Occupied').length : 0;
    if (document.getElementById('l-stat-tenants')) document.getElementById('l-stat-tenants').textContent = activeTenantsCount;
    
    // Overdue Stats (Mock calculation for now based on payment records)
    const overdueCount = payments ? payments.filter(p => p.status === 'Overdue').length : 0;
    if (document.getElementById('l-stat-overdue-count')) document.getElementById('l-stat-overdue-count').textContent = overdueCount;

    // Income Stats
    let totalIncome = 0;
    if (payments) {
      totalIncome = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    }
    const formattedIncome = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KSh' }).format(totalIncome);
    if (document.getElementById('l-stat-income')) document.getElementById('l-stat-income').textContent = formattedIncome;
    if (document.getElementById('l-income-collected')) document.getElementById('l-income-collected').textContent = formattedIncome;

    // Maintenance Stats
    const openMaint = maint ? maint.filter(m => m.status !== 'Resolved').length : 0;
    if (document.getElementById('l-stat-maint')) document.getElementById('l-stat-maint').textContent = openMaint;

    // --- RENDER LISTS ---
    renderLProps(props || []);
    renderLTenants(props || []);
    renderLPayments(payments || []);
    renderLMaints(maint || []);
    renderLDocs(docs || []);
    renderLSettings(user);

    console.log('📊 Landlord Dashboard Synced');
  } catch (err) {
    console.error('❌ Landlord Sync Error:', err);
  }
};

function renderLPayments(payments) {
    const tb = document.getElementById('l-payments-tbody');
    if (!tb) return;
    if (!payments || payments.length === 0) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--g500);">No payment records found.</td></tr>';
        return;
    }
    tb.innerHTML = payments.map(p => `
        <tr>
            <td style="font-size:11px;color:var(--g500);">PAY-00${p.id.toString().slice(0,4)}</td>
            <td style="font-weight:600;">Grace Wanjiku</td>
            <td>Unit 3B</td>
            <td style="font-weight:700;color:var(--blue);">KSh ${(p.amount || 0).toLocaleString()}</td>
            <td style="font-size:12px;">${p.method || 'M-Pesa'}</td>
            <td><span class="badge bg">Paid</span></td>
            <td style="text-align:right;">
                <button class="btn bs bxs" onclick="lViewPayment('${p.id}')">View</button>
            </td>
        </tr>
    `).join('');
}

function renderLMaints(maint) {
    const list = document.getElementById('l-maint-list');
    if (!list) return;
    if (!maint || maint.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--g500);"><div style="font-size:32px;margin-bottom:10px;">🔧</div><div style="font-weight:500;">No active requests</div></div>`;
        return;
    }
    list.innerHTML = maint.map(m => `
        <div class="dcard" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
                <div style="font-weight:600;">${m.issue_description}</div>
                <div style="font-size:12px;color:var(--g500);">Unit: Sunrise 3B · Urgency: ${m.urgency}</div>
            </div>
            <div style="text-align:right;">
                <span class="badge ${m.status === 'Resolved' ? 'bg' : 'ba'}">${m.status}</span>
                <button class="btn bs bxs" style="margin-left:5px;" onclick="lViewMaint('${m.id}')">Update</button>
            </div>
        </div>
    `).join('');
}

function renderLDocs(docs) {
    const tb = document.getElementById('l-doc-tbody');
    if (!tb) return;
    if (!docs || docs.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--g500);">No documents uploaded.</td></tr>';
        return;
    }
    tb.innerHTML = docs.map(d => `
        <tr>
            <td style="font-weight:600;">Grace Wanjiku</td>
            <td>${d.name}</td>
            <td style="font-size:12px;color:var(--g500);">${d.size || '350 KB'} / ${new Date(d.created_at).toLocaleDateString()}</td>
            <td><span class="badge ${d.status === 'Active' ? 'bg' : 'ba'}">${d.status}</span></td>
            <td style="text-align:right;">
                <button class="btn bs bxs" onclick="lDocView('${d.url}')">View</button>
                <button class="btn bs bxs" onclick="lDocEdit('${d.id}')">Edit</button>
                <button class="btn bxs" style="color:var(--red);border-color:var(--red);" onclick="lDocDel('${d.id}')">Del</button>
            </td>
        </tr>
    `).join('');
}

function renderLSettings(user) {
    if (!user) return;
    document.getElementById('l-set-email-display').textContent = user.email;
    
    // Fetch real profile for name, phone, mpesa and universal avatar sync
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({data}) => {
        if (data) {
            const realName = data.name || user.user_metadata?.fullname || 'Landlord';
            const initial = realName.charAt(0).toUpperCase();

            // 1. Update Display Names (Sidebar & Card)
            if (document.getElementById('l-sidebar-name')) document.getElementById('l-sidebar-name').textContent = realName;
            if (document.getElementById('l-set-name-display')) document.getElementById('l-set-name-display').textContent = realName;
            
            // 2. Update Input Fields
            if (document.getElementById('l-set-name')) document.getElementById('l-set-name').value = data.name || '';
            if (document.getElementById('l-set-phone')) document.getElementById('l-set-phone').value = data.phone || '';
            if (document.getElementById('l-set-mpesa')) document.getElementById('l-set-mpesa').value = data.mpesa_no || '';
            
            // 3. Update Avatars (Sidebar & Card)
            if (document.getElementById('l-avatar')) document.getElementById('l-avatar').textContent = initial;
            if (document.getElementById('l-set-avatar')) document.getElementById('l-set-avatar').textContent = initial;
        }
    });
}

function renderLTenants(props) {
    const list = document.getElementById('l-tenants-list');
    if (!list) return;
    
    const occupied = props.filter(p => p.status === 'Occupied');
    
    if (occupied.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--g500);">
                <div style="font-size:32px;margin-bottom:10px;">👥</div>
                <div style="font-weight:500;">No tenants found</div>
                <div style="font-size:12px;margin-top:5px;">Tenants will appear here once linked to a property.</div>
            </div>`;
        return;
    }

    list.innerHTML = `
        <table class="ltable">
            <thead>
                <tr>
                    <th style="text-align:left;">Tenant</th>
                    <th style="text-align:left;">Property / Unit</th>
                    <th style="text-align:left;">Rent Status</th>
                    <th style="text-align:right;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${occupied.map(t => `
                    <tr>
                        <td>
                            <div style="font-weight:600;">Grace Wanjiku</div>
                            <div style="font-size:11px;color:var(--g500);">+254 753 348 298</div>
                        </td>
                        <td>${t.title}</td>
                        <td><span class="badge bg">Paid</span></td>
                        <td style="text-align:right;">
                            <button class="btn bwa bxs" onclick="waTenant('+254753348298', 'Grace')">WA</button>
                            <button class="btn bs bxs" onclick="lViewTenant('Grace')">View</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}

// --- ADMIN PORTAL ACTIONS ---

window.fetchAdminData = async function() {
  try {
    // 1. Fetch Key Stats
    const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: tCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Tenant');
    const { count: lCount_user } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Landlord');

    const { count: listingTotal } = await supabase.from('listings').select('*', { count: 'exact', head: true });
    const { count: listingAvail } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'Available');
    const { count: listingOcc } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'Occupied');

    const { data: pData } = await supabase.from('payments').select('amount, status');
    const { count: mCount } = await supabase.from('maintenance').select('*', { count: 'exact', head: true, eq: { status: 'Open' } });

    const totalRev = pData?.filter(p => p.status === 'Paid').reduce((s, p) => s + (p.amount || 0), 0) || 0;
    const pendingRev = pData?.filter(p => p.status === 'Pending').reduce((s, p) => s + (p.amount || 0), 0) || 0;

    // 2. Update Dashboard UI Stats
    if (document.getElementById('a-stat-users')) document.getElementById('a-stat-users').textContent = uCount || 0;
    if (document.getElementById('a-stat-tenants')) document.getElementById('a-stat-tenants').textContent = tCount || 0;
    if (document.getElementById('a-stat-landlords')) document.getElementById('a-stat-landlords').textContent = lCount_user || 0;
    
    if (document.getElementById('a-stat-listings')) document.getElementById('a-stat-listings').textContent = listingTotal || 0;
    if (document.getElementById('a-stat-avail')) document.getElementById('a-stat-avail').textContent = listingAvail || 0;
    if (document.getElementById('a-stat-occ')) document.getElementById('a-stat-occ').textContent = listingOcc || 0;

    if (document.getElementById('a-stat-rev')) document.getElementById('a-stat-rev').textContent = 'KSh ' + totalRev.toLocaleString();
    if (document.getElementById('a-stat-rev-coll')) document.getElementById('a-stat-rev-coll').textContent = 'KSh ' + totalRev.toLocaleString();
    if (document.getElementById('a-stat-rev-pend')) document.getElementById('a-stat-rev-pend').textContent = 'KSh ' + pendingRev.toLocaleString();
    
    if (document.getElementById('a-stat-maint')) document.getElementById('a-stat-maint').textContent = mCount || 0;

    // 3. Render Management Tables
    await Promise.all([
       renderAListings(),
       renderAPayments(),
       renderAMaint(),
       renderAUsers(),
       fetchCMSData() // Fetch CMS info
    ]);

    console.log('🏛️ Admin Portal Synced');
  } catch (err) {
    console.error('❌ Admin Sync Error:', err);
  }
};

// ---------------------------------------------------------
// CMS DATA ENGINE (SUPABASE SYNC)
// ---------------------------------------------------------
async function fetchCMSData() {
  try {
    const [{ data: config }, { data: blogs }, { data: ament }] = await Promise.all([
      supabase.from('site_config').select('*').order('section'),
      supabase.from('blog_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('amenities').select('*').order('name')
    ]);

    if (config) {
      renderSiteText(config.filter(c => c.section !== 'Contact'));
      renderContactDetails(config.filter(c => c.section === 'Contact'));
    }
    if (blogs) renderBlogPosts(blogs);
    if (ament) renderAmenities(ament);
  } catch (err) {
    console.error("CMS Sync Error:", err);
  }
}

function renderSiteText(data) {
  const tbody = document.getElementById('sitetext-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(c => `
    <tr>
      <td><span class="badge bgr">${c.section}</span></td>
      <td style="font-size:13px;font-weight:500;">${c.key}</td>
      <td style="font-size:12px;color:var(--g500);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.value}</td>
      <td>
        <div style="display:flex;gap:4px;">
           <button class="btn bs bxs" onclick="aEditCMS('${c.id}')">Edit</button>
           <button class="btn bxs" style="color:var(--red);border:1px solid var(--red);background:transparent;" onclick="aDeleteConfig('${c.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;">No site text content.</td></tr>';
}

function renderContactDetails(data) {
  const tbody = document.getElementById('contact-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(c => `
    <tr>
      <td><div class="cico" style="font-size:18px;">📞</div></td>
      <td style="font-size:13px;font-weight:500;">${c.label}</td>
      <td style="font-size:13px;">${c.value}</td>
      <td>
        <div style="display:flex;gap:4px;">
           <button class="btn bs bxs" onclick="aEditCMS('${c.id}')">Edit</button>
           <button class="btn bxs" style="color:var(--red);border:1px solid var(--red);background:transparent;" onclick="aDeleteConfig('${c.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;">No contact details.</td></tr>';
}

function renderBlogPosts(data) {
  const tbody = document.getElementById('blog-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(b => `
    <tr>
      <td><span class="badge bb">${b.category}</span></td>
      <td style="font-size:13px;font-weight:500;">${b.title}</td>
      <td style="font-size:11px;color:var(--g500);">${new Date(b.created_at || Date.now()).toLocaleDateString()} · ${b.read_time || '5 min'}</td>
      <td>
        <div style="display:flex;gap:4px;">
           <button class="btn bs bxs" onclick="aEditBlog('${b.id}')">Edit</button>
           <button class="btn bxs" style="color:var(--red);border:1px solid var(--red);background:transparent;" onclick="aDeleteBlog('${b.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;">No blog posts yet.</td></tr>';
}

function renderAmenities(data) {
  const tbody = document.getElementById('amenities-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(a => `
    <tr>
      <td><div class="cico" style="font-size:18px;">${a.icon || '🏠'}</div></td>
      <td style="font-size:13px;font-weight:500;">${a.name}</td>
      <td><span class="badge ${a.status === 'Active' ? 'bg' : 'be'}">${a.status}</span></td>
      <td>
        <div style="display:flex;gap:4px;">
           <button class="btn bs bxs" onclick="aEditAmenity('${a.id}')">Edit</button>
           <button class="btn bxs" style="color:var(--red);border:1px solid var(--red);background:transparent;" onclick="aDeleteAmenity('${a.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;">No amenities listed.</td></tr>';
}

window.aDeleteAmenity = async function(id) {
  if (!confirm("Are you sure you want to delete this amenity?")) return;
  await supabase.from('amenities').delete().eq('id', id);
  fetchCMSData();
};

window.aDeleteBlog = async function(id) {
  if (!confirm("Are you sure you want to delete this blog post?")) return;
  await supabase.from('blog_posts').delete().eq('id', id);
  fetchCMSData();
};

window.aDeleteConfig = async function(id) {
  if (!confirm("Are you sure you want to delete this content item?")) return;
  await supabase.from('site_config').delete().eq('id', id);
  fetchCMSData();
};

// --- CMS EDIT/SAVE MODALS ---

window.aEditCMS = async function(id) {
  const { data: item } = await supabase.from('site_config').select('*').eq('id', id).single();
  if (!item) return;

  const body = `
    <div style="margin-bottom:15px;">
      <label class="dfl">Value</label>
      <textarea id="cms-item-val" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--g200);min-height:80px;">${item.value}</textarea>
    </div>`;

  showModal(`Edit ${item.label}`, body, `
    <button class="btn bp" style="flex:1;" onclick="aSaveCMS('${id}')">Save Changes</button>
    <button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Cancel</button>
  `);
};

window.aSaveCMS = async function(id) {
  const val = document.getElementById('cms-item-val').value;
  await supabase.from('site_config').update({ value: val }).eq('id', id);
  cmsCloseModal();
  toast('✅ Content updated', true);
  fetchCMSData();
};

window.aEditBlog = async function(id) {
  const { data: b } = await supabase.from('blog_posts').select('*').eq('id', id).single();
  if (!b) return;

  const body = `
    <div style="margin-bottom:12px;"><label class="dfl">Title</label><input id="blg-title" value="${b.title || ''}"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Category</label><input id="blg-cat" value="${b.category || ''}"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Read Time</label><input id="blg-time" value="${b.read_time || '5 min read'}"></div>
  `;

  showModal('Edit Blog Post', body, `
    <button class="btn bp" style="flex:1;" onclick="aSaveBlog('${id}')">Save Post</button>
    <button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Cancel</button>
  `);
};

window.aSaveBlog = async function(id) {
  const obj = {
    title: document.getElementById('blg-title').value,
    category: document.getElementById('blg-cat').value,
    read_time: document.getElementById('blg-time').value
  };
  await supabase.from('blog_posts').update(obj).eq('id', id);
  cmsCloseModal();
  toast('📝 Blog post updated', true);
  fetchCMSData();
};

window.aEditAmenity = async function(id) {
  const { data: a } = await supabase.from('amenities').select('*').eq('id', id).single();
  if (!a) return;

  const body = `
    <div style="margin-bottom:12px;"><label class="dfl">Name</label><input id="amn-name" value="${a.name || ''}"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Icon (Emoji)</label><input id="amn-icon" value="${a.icon || '✨'}"></div>
  `;

  showModal('Edit Amenity', body, `
    <button class="btn bp" style="flex:1;" onclick="aSaveAmenity('${id}')">Save Amenity</button>
    <button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Cancel</button>
  `);
};

window.aSaveAmenity = async function(id) {
  const obj = {
    name: document.getElementById('amn-name').value,
    icon: document.getElementById('amn-icon').value
  };
  await supabase.from('amenities').update(obj).eq('id', id);
  cmsCloseModal();
  toast('✨ Amenity updated', true);
  fetchCMSData();
};

// --- USER & PROPERTY ACTIONS ---

window.aUserAction = async function(mode, id) {
  const { data: u } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (!u) return;

  if (mode === 'del') {
    if (!confirm(`Delete user ${u.name}?`)) return;
    await supabase.from('profiles').delete().eq('id', id);
    toast('🗑️ User deleted', true);
    renderAUsers();
  } else if (mode === 'edit') {
    const body = `<div class="df"><label class="dfl">Name</label><input id="edt-u-name" value="${u.name}"></div>`;
    showModal('Edit User', body, `<button class="btn bp" style="flex:1;" onclick="aSaveUser('${id}')">Save Changes</button>`);
  }
};

window.aSaveUser = async function(id) {
  const name = document.getElementById('edt-u-name').value;
  await supabase.from('profiles').update({ name }).eq('id', id);
  cmsCloseModal();
  toast('✅ User updated', true);
  renderAUsers();
};

window.aPropAction = async function(mode, id) {
  const { data: l } = await supabase.from('listings').select('*').eq('id', id).single();
  if (!l) return;

  if (mode === 'del') {
    if (!confirm(`Delete listing ${l.title}?`)) return;
    await supabase.from('listings').delete().eq('id', id);
    toast('🗑️ Listing removed', true);
    renderAListings();
  } else if (mode === 'edit') {
    const body = `<div class="df"><label class="dfl">Price (KSh)</label><input id="edt-l-price" type="number" value="${l.price}"></div>`;
    showModal('Edit Listing', body, `<button class="btn bp" style="flex:1;" onclick="aSaveProp('${id}')">Save Price</button>`);
  }
};

window.aSaveProp = async function(id) {
  const price = parseInt(document.getElementById('edt-l-price').value);
  await supabase.from('listings').update({ price }).eq('id', id);
  cmsCloseModal();
  toast('✅ Price updated', true);
  renderAListings();
};

// --- ADD NEW CONTENT LOGIC ---

window.aAddAmenity = function() {
  const body = `
    <div style="margin-bottom:12px;"><label class="dfl">Name</label><input id="new-amn-name" placeholder="e.g. Swimming Pool"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Icon (Emoji)</label><input id="new-amn-icon" placeholder="🏊"></div>
  `;
  showModal('Add New Amenity', body, `
    <button class="btn bp" style="flex:1;" onclick="aSaveNewAmenity()">Add Amenity</button>
    <button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Cancel</button>
  `);
};

window.aSaveNewAmenity = async function() {
  const obj = {
    name: document.getElementById('new-amn-name').value,
    icon: document.getElementById('new-amn-icon').value || '✨',
    status: 'Active'
  };
  await supabase.from('amenities').insert(obj);
  cmsCloseModal();
  toast('✨ New amenity added', true);
  fetchCMSData();
};

window.aAddBlog = function() {
  const body = `
    <div style="margin-bottom:12px;"><label class="dfl">Title</label><input id="new-blg-title" placeholder="Post title"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Category</label><input id="new-blg-cat" placeholder="Tips"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Read Time</label><input id="new-blg-time" placeholder="5 min read"></div>
  `;
  showModal('Add Blog Post', body, `
    <button class="btn bp" style="flex:1;" onclick="aSaveNewBlog()">Create Post</button>
    <button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Cancel</button>
  `);
};

window.aSaveNewBlog = async function() {
  const obj = {
    title: document.getElementById('new-blg-title').value,
    category: document.getElementById('new-blg-cat').value,
    read_time: document.getElementById('new-blg-time').value
  };
  await supabase.from('blog_posts').insert(obj);
  cmsCloseModal();
  toast('📝 New blog post created', true);
  fetchCMSData();
};

window.aAddConfig = function(section) {
   const body = `
    <div style="margin-bottom:12px;"><label class="dfl">Label</label><input id="new-cfg-label" placeholder="e.g. WhatsApp"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Key</label><input id="new-cfg-key" placeholder="w_app"></div>
    <div style="margin-bottom:12px;"><label class="dfl">Value</label><textarea id="new-cfg-val"></textarea></div>
  `;
  showModal(`Add to ${section}`, body, `
    <button class="btn bp" style="flex:1;" onclick="aSaveNewConfig('${section}')">Add Item</button>
    <button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Cancel</button>
  `);
}

window.aSaveNewConfig = async function(section) {
  const obj = {
    section,
    label: document.getElementById('new-cfg-label').value,
    key: document.getElementById('new-cfg-key').value,
    value: document.getElementById('new-cfg-val').value
  };
  await supabase.from('site_config').insert(obj);
  cmsCloseModal();
  toast('✅ New content added', true);
  fetchCMSData();
}

window.renderAListings = async function() {
  const tb = document.getElementById('a-listings-tbody');
  if (!tb) return;
  
  // Use join to get landlord name from profiles table
  const { data, error } = await supabase
    .from('listings')
    .select('*, profiles(name)')
    .order('created_at', { ascending: false });

  if (error) { console.error('Listings Fetch Error:', error); return; }

  tb.innerHTML = (data || []).map(l => `
    <tr>
      <td><div style="font-weight:500;">${l.title}</div><div style="font-size:11px;color:var(--g500);">${l.location}</div></td>
      <td style="font-size:13px;">${l.profiles?.name || 'Owner'}</td>
      <td style="font-size:12px;">${l.type || 'Hse'}</td>
      <td style="font-weight:600;color:var(--blue);">KSh ${l.price?.toLocaleString()}</td>
      <td><span class="badge ${l.status === 'Available' ? 'bg' : 'ba'}">${l.status}</span></td>
      <td>
        <div style="display:flex;gap:4px;">
           <button class="btn bs bxs" onclick="aEditListing('${l.id}')">Edit</button>
           <button class="btn bxs" style="color:var(--red);border:1px solid var(--red);background:transparent;" onclick="aDeleteListing('${l.id}')">Del</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--g500);">No listings found.</td></tr>';
};

window.renderAPayments = async function() {
  const tb = document.getElementById('a-payment-tbody');
  if (!tb) return;
  const { data } = await supabase.from('payments').select('*').order('date', { ascending: false });
  tb.innerHTML = (data || []).map(p => `
    <tr>
      <td><div style="font-weight:500;font-size:13px;">${p.tenant_name}</div></td>
      <td style="font-size:12px;color:var(--g500);">${p.property_name}</td>
      <td style="font-weight:600;color:var(--blue);">KSh ${p.amount?.toLocaleString()}</td>
      <td><span class="badge bgr">${p.method}</span></td>
      <td style="font-family:monospace;font-size:11px;">${p.reference || '---'}</td>
      <td style="font-size:11px;">${new Date(p.date).toLocaleDateString()}</td>
      <td><span class="badge ${p.status === 'Paid' ? 'bg' : 'br'}">${p.status}</span></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--g500);">No transactions.</td></tr>';
};

window.renderAMaint = async function() {
  const tb = document.getElementById('a-maint-tbody');
  if (!tb) return;
  const { data } = await supabase.from('maintenance').select('*').order('created_at', { ascending: false });
  tb.innerHTML = (data || []).map(m => `
    <tr>
      <td style="font-size:13px;">${m.tenant_name || 'Tenant'}</td>
      <td style="font-size:12px;color:var(--g500);">${m.property_name}</td>
      <td style="font-size:13px;">${m.issue_description}</td>
      <td><span class="badge ba">${m.urgency || 'Medium'}</span></td>
      <td><span class="badge ${m.status === 'Open' ? 'br' : 'bb'}">${m.status}</span></td>
      <td>
        <div style="display:flex;gap:4px;">
           <button class="btn bs bxs" onclick="aEditMaint('${m.id}')">Update</button>
           <button class="btn bxs" style="color:var(--red);border:1px solid var(--red);background:transparent;" onclick="aDeleteMaint('${m.id}')">Del</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--g500);">No maintenance requests.</td></tr>';
};

window.renderAUsers = async function() {
  const tb = document.getElementById('a-users-tbody');
  if (!tb) return;
  const { data } = await supabase.from('profiles').select('*');
  tb.innerHTML = (data || []).map(u => `
    <tr>
      <td><div style="font-weight:500;">${u.name || 'User'}</div><div style="font-size:11px;color:var(--g500);">${u.email}</div></td>
      <td><span class="badge bgr">${u.role || 'Tenant'}</span></td>
      <td style="font-size:12px;">${new Date(u.created_at).toLocaleDateString()}</td>
      <td><span class="badge bg">Active</span></td>
      <td><button class="btn bs bxs" onclick="aViewUser('${u.id}')">Manage</button></td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--g500);">No users found.</td></tr>';
};

window.aResetEverything = async function() {
  const confirm1 = confirm('⚠️ WARNING: You are about to PERMANENTLY ERASE everything on this platform (Listings, Payments, Maintenance).\n\nAre you absolutely sure?');
  if (!confirm1) return;
  
  const confirm2 = confirm('🛑 FINAL CONFIRMATION: This action is UN-REVERSIBLE. Do you want to continue?');
  if (!confirm2) return;

  try {
    toast('⏳ Initializing System Wipe...', true);
    
    // Clear all tables
    await Promise.all([
      supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // Delete all
      supabase.from('listings').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('maintenance').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('leases').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);

    toast('✅ SYSTEM WIPED SUCCESSFULLY! The platform is now blank.', true);
    fetchAdminData(); // Refresh the counts
  } catch (err) {
    toast('❌ Error wiping data: ' + err.message, false);
  }
};

window.saveAdminSettings = async function() {
  const btn = document.querySelector('button[onclick="saveAdminSettings()"]');
  const name = document.getElementById('a-set-name')?.value;
  const email = document.getElementById('a-set-email')?.value;
  const phone = document.getElementById('a-set-phone')?.value;

  if (!email || !name) { toast('⚠️ Name and Email are required', false); return; }

  try {
    toast('⏳ Saving settings...', true);
    const { error } = await supabase.from('platform_settings').upsert({
      id: 1, // Global settings always ID 1
      platform_name: name,
      admin_email: email,
      whatsapp_number: phone,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
    toast('✅ Platform settings saved!', true);
  } catch (err) {
    toast('❌ Save Error: ' + err.message, false);
  }
};

window.aDeleteListing = async function(id) {
  if (!confirm('Delete this listing permanently?')) return;
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) toast('❌ Error: ' + error.message, false);
  else { toast('🗑 Listing deleted', true); renderAListings(); }
};

window.aDeleteMaint = async function(id) {
  if (!confirm('Delete this maintenance request?')) return;
  const { error } = await supabase.from('maintenance').delete().eq('id', id);
  if (error) toast('❌ Error: ' + error.message, false);
  else { toast('🗑 Request deleted', true); renderAMaint(); }
};

// --- LANDLORD ACTIONS ---

window.lRecordPayment = async function() {
  const tenantSel = document.getElementById('pay-tenant')?.value;
  const amount = document.getElementById('pay-amount')?.value;
  const method = document.getElementById('pay-method')?.value;
  const ref = document.getElementById('pay-ref')?.value;

  if (!tenantSel || !amount) { toast('⚠️ Please fill in Tenant and Amount', false); return; }

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('payments').insert([{
    landlord_id: user.id,
    tenant_name: tenantSel.split(' - ')[0] || tenantSel,
    property_name: tenantSel.split(' - ')[1] || 'Default Property',
    amount: parseFloat(amount),
    method: method,
    reference: ref,
    status: 'Paid',
    date: new Date().toISOString()
  }]);

  if (error) { toast('❌ Error: ' + error.message, false); }
  else {
    toast('✅ Payment recorded successfully!', true);
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-ref').value = '';
    fetchLandlordData();
  }
};

window.lUpdateMaint = async function() {
  const reqId = document.getElementById('maint-select')?.value;
  const status = document.getElementById('maint-status')?.value;
  const note = document.getElementById('maint-note')?.value;

  if (!reqId || reqId === 'Select Request') { toast('⚠️ Please select a request', false); return; }

  const { error } = await supabase.from('maintenance')
    .update({ status: status, landlord_note: note })
    .eq('id', reqId);

  if (error) { toast('❌ Error: ' + error.message, false); }
  else {
    toast('✅ Maintenance status updated!', true);
    fetchLandlordData();
  }
};

window.lAddProperty = function() {
  showModal('Add New Property', `
    <div style="display:flex;flex-direction:column;gap:12px;text-align:left;">
      <div><label style="font-size:12px;font-weight:600;color:var(--g500);">Property Name</label>
      <input type="text" id="new-prop-name" placeholder="e.g. Sunrise Apartments" style="width:100%;padding:10px;border:1px solid var(--g200);border-radius:6px;"></div>
      
      <div><label style="font-size:12px;font-weight:600;color:var(--g500);">Monthly Rent (KSh)</label>
      <input type="number" id="new-prop-rent" placeholder="15000" style="width:100%;padding:10px;border:1px solid var(--g200);border-radius:6px;"></div>
      
      <div><label style="font-size:12px;font-weight:600;color:var(--g500);">Location</label>
      <input type="text" id="new-prop-loc" placeholder="e.g. Nakuru CBD" style="width:100%;padding:10px;border:1px solid var(--g200);border-radius:6px;"></div>
    </div>
  `, `
    <button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Cancel</button>
    <button class="btn bg-btn" style="flex:1;" onclick="confirmAddProperty()">Save Property</button>
  `);
};

window.confirmAddProperty = async function() {
  const name = document.getElementById('new-prop-name').value;
  const rent = document.getElementById('new-prop-rent').value;
  const loc = document.getElementById('new-prop-loc').value;

  if (!name || !rent) { toast('⚠️ Please fill in at least Name and Rent', false); return; }

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('listings').insert([{
    landlord_id: user.id,
    title: name,
    price: parseFloat(rent),
    location: loc,
    status: 'Available',
    type: 'Apartment'
  }]);

  if (error) { toast('❌ Error: ' + error.message, false); }
  else {
    toast('✅ Property added successfully!', true);
    cmsCloseModal();
    fetchLandlordData(); // Refresh everything
  }
};

function renderLProps(props) {
    const list = document.getElementById('l-props-list');
    if (!list) return;
    if (props.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:80px;color:var(--g500);background:#fff;border-radius:var(--rmd);border:1.5px dashed var(--g200);">
                <div style="font-size:48px;margin-bottom:15px;">🏗️</div>
                <h3 style="color:var(--g800);">No properties yet</h3>
                <p style="margin-bottom:20px;">Start by adding your first rental property to the platform.</p>
                <button class="btn bg-btn" onclick="lAddProperty()">+ Add my first property</button>
            </div>`;
        return;
    }
    list.innerHTML = props.map(p => `
        <div class="dcard" style="padding:0;overflow:hidden;margin-bottom:16px;border-top:3px solid ${p.status === 'Occupied' ? '#2F5D44' : '#8B5E3C'};">
            <div style="padding:15px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #f2f2f2;">
                <div>
                    <div style="font-weight:700;font-size:16px;color:var(--g800);">${p.title}</div>
                    <div style="font-size:12px;color:var(--g500);margin-top:2px;">📍 ${p.location || 'Location Pending'}</div>
                    <div style="display:flex;gap:5px;margin-top:8px;">
                        <span class="badge bb">1 BR</span><span class="badge bt">WiFi</span><span class="badge bt">Water</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                     <span class="badge ${p.status === 'Available' ? 'ba' : 'bg'}" style="padding:4px 10px;">${p.status}</span>
                     <button class="btn bs bxs" style="border:1px solid var(--blue);color:var(--blue);background:#fff;" onclick="lViewProperty('${p.id}')">View</button>
                     <button class="btn bs bxs" style="border:1px solid var(--blue);color:var(--blue);background:#fff;" onclick="lEditProperty('${p.id}')">Edit</button>
                     <button class="btn bxs" style="border:1px solid var(--red);color:var(--red);background:#fff;" onclick="lDeleteProperty('${p.id}')">Del</button>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#fafafa;">
                <div style="padding:15px;text-align:center;border-right:1px solid #eee;">
                    <div style="font-weight:700;color:var(--g800);">KSh ${(p.price || 0).toLocaleString()}</div>
                    <div style="font-size:10px;color:var(--g500);text-transform:uppercase;margin-top:2px;">Monthly rent</div>
                </div>
                <div style="padding:15px;text-align:center;border-right:1px solid #eee;">
                    <div style="font-weight:700;color:var(--g800);">${p.status === 'Occupied' ? 'Grace W.' : 'Vacant'}</div>
                    <div style="font-size:10px;color:var(--g500);text-transform:uppercase;margin-top:2px;">Tenant / Status</div>
                </div>
                <div style="padding:15px;text-align:center;">
                    <div style="font-weight:700;color:var(--g800);">${p.status === 'Occupied' ? '9 mo' : '14 days'}</div>
                    <div style="font-size:10px;color:var(--g500);text-transform:uppercase;margin-top:2px;">Lease / Listed</div>
                </div>
            </div>
        </div>
    `).join('');
}

window.lDeleteProperty = async function(id) {
    if(!confirm('⚠️ Are you sure you want to delete this property? This cannot be undone.')) return;
    try {
        const { error } = await supabase.from('listings').delete().eq('id', id);
        if(error) throw error;
        toast('🗑️ Property deleted successfully!', true);
        // Instant visual refresh
        if (typeof fetchLandlordData === 'function') fetchLandlordData();
    } catch(err) {
        toast('❌ Error: ' + err.message, false);
    }
};

window.lViewProperty = function(id) {
    viewPropertyDetails(id);
};
async function loadState() {
  try {
    if (!window.supabase) return;
    const { data: listings, error: lError } = await supabase.from('listings').select('*');
    if (lError) throw lError;
    if (listings) window.PLATFORM_STATE.properties = listings;

    const { data: users, error: uError } = await supabase.from('profiles').select('*');
    if (!uError && users) window.PLATFORM_STATE.users = users;

    console.log('☁️ Supabase Data Loaded:', { listings: window.PLATFORM_STATE.properties.length });
    renderAllDynamic();
  } catch (err) {
    console.error('❌ Database Fetch Error:', err.message);
    renderAllDynamic();
  }
}

// ---- PROFILE SAVE (Settings Page) ----
/* Profile saving logic moved to the main saveProfile function at line 107 */

// ---- CHANGE PASSWORD ----
window.changePassword = async function() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast('\u274c You must be logged in.', false); return; }

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) {
    toast('\u274c Error: ' + error.message, false);
  } else {
    toast('\u2705 Password reset email sent to ' + user.email, true);
  }
};

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
    const waUrl = 'https://wa.me/254753348298?text=' + encodeURIComponent(msg);
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

// Helper for CSV Download
async function downloadCSV(tableName, fileName) {
    toast(`📥 Fetching data for ${fileName}...`, true);
    const { data, error } = await supabase.from(tableName).select('*');
    if (error || !data || data.length === 0) {
        toast('❌ Error: No data found to export', false);
        return;
    }
    
    // Generate CSV data:text/csv string
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
        Object.values(row).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + "\n" + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", fileName + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('✅ Download complete!', true);
}

window.lExportCSV = function () {
  showModal('Export CSV', '<p>Download the current view as CSV?</p>',
    `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); downloadCSV("listings", "Property_Listings_Export");'>Download</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};
let EDIT_PROPERTY_ID = null;

window.lAddProperty = function () {
  EDIT_PROPERTY_ID = null;
  showModal('New Listing', `<div style='text-align:left;display:flex;flex-direction:column;gap:12px;'>
      <div class='df'><label class='dfl'>PROPERTY NAME</label><input type='text' id='nl-name' placeholder='e.g. Sunrise Apts 4C' style='width:100%'></div>
      <div class='df'><label class='dfl'>LOCATION</label><input type='text' id='nl-location' placeholder='e.g. KisumuTown' style='width:100%'></div>
      <div class='df'><label class='dfl'>LANDLORD EMAIL</label><input type='email' id='nl-email' placeholder='landlord@example.com' style='width:100%'></div>
      <div class='df'><label class='dfl'>RENT (KSH)</label><input type='number' id='nl-rent' placeholder='15000' style='width:100%'></div>
      <div class='df'><label class='dfl'>PROPERTY IMAGES (MAX 6)</label>
        <div id='nl-preview' style='display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px;'></div>
        <div style='border:2px dashed var(--g200);border-radius:var(--rsm);padding:20px;text-align:center;cursor:pointer;' onclick='document.getElementById("nl-img-inp").click()'>
          <span style='font-size:24px;'>📷</span>
          <p style='font-size:12px;color:var(--g500);margin-top:5px;'>Click to upload or drag and drop</p>
          <input type='file' id='nl-img-inp' multiple accept='image/*' style='display:none;' onchange='handleImagePreview(this, "nl-preview")'>
        </div>
      </div>
    </div>`,
    `<button class='btn bg-btn' id='nl-create-btn' style='flex:1;' onclick='lSaveProperty()'>Create</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lEditProperty = async function(id) {
    EDIT_PROPERTY_ID = id;
    toast('📂 Fetching property data...', true);
    
    let p = null;
    // Explicitly join using landlord_id to avoid schema errors
    const { data: d1, error: e1 } = await supabase
        .from('listings')
        .select(`*, profiles!listings_landlord_id_fkey (email)`)
        .eq('id', id)
        .single();

    if(!e1 && d1) p = d1;
    else {
        console.warn('Edit Fetch Try 1 Failed:', e1);
        const { data: d2, error: e2 } = await supabase.from('listings').select('*, profiles(email)').eq('id', id).single();
        if (e2) { 
            console.error('Edit Fetch Try 2 Failed:', e2);
            toast('❌ Error fetching data', false); 
            return; 
        }
        p = d2;
    }

    window.lAddProperty(); // Open modal
    const title = document.getElementById('nl-modal-title');
    if (title) title.textContent = 'Edit Property';
    document.getElementById('nl-name').value = p.title || p.name;
    document.getElementById('nl-location').value = p.location || '';
    document.getElementById('nl-email').value = p.profiles?.email || '';
    document.getElementById('nl-rent').value = p.price;
    document.getElementById('nl-create-btn').textContent = 'Save Changes';
};

window.lViewProperty = function(id) {
    toast('🔍 Navigating to listing...', true);
    viewPropertyDetails(id);
};

window.lSaveProperty = async function () {
  const name = document.getElementById('nl-name')?.value?.trim();
  const loc = document.getElementById('nl-location')?.value?.trim();
  const email = document.getElementById('nl-email')?.value?.trim();
  const rent = document.getElementById('nl-rent')?.value;
  const btn = document.getElementById('nl-create-btn');

  if (!name || !email || !rent) { toast('Please fill in all fields', false); return; }
  
  const finalLocation = loc || 'Location Not Specified';

  btn.disabled = true;
  btn.textContent = EDIT_PROPERTY_ID ? 'Saving...' : 'Creating...';

  try {
    // 1. Lookup landlord id by email (Using case-insensitive match for reliability)
    const { data: p, error: lErr } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .single();

    if (lErr || !p) { 
      console.warn('Profile Lookup Error:', lErr);
      throw new Error('Landlord email not found. Please ensure the landlord has an account and has logged in at least once.'); 
    }

    const payload = { 
        title: name,
        name: name,
        type: 'House',
        price: parseInt(rent), 
        landlord_id: p.id,
        status: 'Available',
        location: finalLocation, 
        image_url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&q=80&w=800'
    };

    let result;
    if(EDIT_PROPERTY_ID) {
        result = await supabase.from('listings').update(payload).eq('id', EDIT_PROPERTY_ID);
    } else {
        result = await supabase.from('listings').insert([payload]);
    }
    
    if (result.error) throw result.error;

    toast(EDIT_PROPERTY_ID ? '📝 Property updated!' : '🏠 Property listed successfully!', true);
    cmsCloseModal();

    // Refresh views if applicable
    if (typeof fetchLandlordData === 'function') fetchLandlordData();
    if (typeof fetchAdminData === 'function') fetchAdminData();
    if (typeof renderAllListings === 'function') renderAllListings(); // Public view

  } catch (err) {
    console.error('List Error:', err);
    toast('❌ ' + err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create';
  }
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
  const waUrl = 'https://wa.me/254753348298?text=' + encodeURIComponent(txt);
  showModal('Send via WhatsApp', `<p>This will open WhatsApp with your message pre-filled.</p>`,
    `<button class='btn bwa' style='flex:1;' onclick='window.open("${waUrl}", "_blank"); cmsCloseModal();'>Open WhatsApp</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lMaintRespond = function (issue, name) {
  showModal('Respond to ' + name, `<div class='df'><label class='dfl'>Response</label><textarea style='width:100%;height:80px;'></textarea></div>`,
    `<button class='btn bp' style='flex:1;' onclick='cmsCloseModal(); toast("✅ Response sent!", true);'>Send</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.lMaintUpdateNotify = async function () {
    const mId = document.getElementById('l-maint-select')?.value;
    const nS = document.getElementById('l-maint-new-status')?.value;
    if(!mId) { toast('Please select a request to update.', false); return; }

    try {
        const { error } = await supabase.from('maintenance').update({ status: nS }).eq('id', mId);
        if (error) throw error;

        toast('✅ Request status updated to ' + nS, true);
        
        // Auto-refresh the landlord view
        const { data: { session } } = await supabase.auth.getSession();
        if(session && session.user) {
            hydrateUserDashboards(session.user);
        }
    } catch (err) {
        toast('❌ Update Error: ' + err.message, false);
    }
};
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
  const tableMap = {
      'Revenue Report': 'payments',
      'Occupancy Report': 'listings',
      'User Activity Report': 'profiles',
      'Payment Report': 'payments',
      'Maintenance Report': 'maintenance',
      'Export All Data': 'listings'
  };
  const table = tableMap[name] || 'listings';

  showModal('Generate ' + name, `<p>Preparing data for <strong>${name}</strong>. Ready to download as CSV?</p>`,
    `<button class='btn bg-btn' style='flex:1;' onclick='cmsCloseModal(); downloadCSV("${table}", "${name.replace(/ /g, '_')}");'>Download CSV</button><button class='btn bs' style='flex:1;' onclick='cmsCloseModal()'>Cancel</button>`
  );
};

window.aAddListing = function () {
  lAddProperty(); // Use unified property creation logic
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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Marshal Rentals App Started.');

  // 1. Initial Data Fetch
  loadState();

  // 2. Check for active session and auto-populate + auto-route
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    const user = session.user;
    const role = (user.user_metadata.role || 'Tenant').toLowerCase();
    const userName = user.user_metadata.name || 'User';
    window.CURRENT_USER_NAME = userName;

    if (role === 'tenant') {
      // Tenant Sidebar
      const sidebarName = document.getElementById('t-sidebar-name');
      const avatar = document.getElementById('t-avatar');
      if (sidebarName) sidebarName.textContent = userName;
      if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();

      // Tenant Settings
      const nameField = document.getElementById('t-set-name');
      const emailField = document.getElementById('t-set-email');
      if (nameField) nameField.value = userName;
      if (emailField) emailField.value = user.email || '';

      // Fetch tenant phone
      const { data: profile } = await supabase.from('profiles').select('phone').eq('id', user.id).single();
      const phoneField = document.getElementById('t-set-phone');
      if (phoneField && profile?.phone) phoneField.value = profile.phone;
    } 
    else if (role === 'landlord') {
      // Landlord Sidebar
      const sidebarName = document.getElementById('l-sidebar-name');
      const avatar = document.getElementById('l-avatar');
      if (sidebarName) sidebarName.textContent = userName;
      if (avatar) avatar.textContent = userName.charAt(0).toUpperCase();

      // Landlord Settings
      const nameField = document.getElementById('l-set-name');
      const nameDisp = document.getElementById('l-set-name-display');
      const emailDisp = document.getElementById('l-set-email-display');
      if (nameField) nameField.value = userName;
      if (nameDisp) nameDisp.textContent = userName;
      if (emailDisp) emailDisp.textContent = user.email || '';

      // Fetch landlord profile data (phone, mpesa)
      const { data: profile } = await supabase.from('profiles').select('phone, mpesa_payout').eq('id', user.id).single();
      const phoneField = document.getElementById('l-set-phone');
      const mpesaField = document.getElementById('l-set-mpesa');
      if (phoneField && profile?.phone) phoneField.value = profile.phone;
      if (mpesaField && profile?.mpesa_payout) mpesaField.value = profile.mpesa_payout;

      // Trigger Data Sync
      if (role === 'admin') fetchAdminData();
      if (role === 'landlord') fetchLandlordData();
    }

    console.log('🔄 Session found. Routing to ' + role);
    gto(role);
    if (role === 'admin') ds('admin', 'a-dash');
    else if (role === 'landlord') ds('landlord', 'l-overview');
    else ds('tenant', 't-overview');
  }
});

// --- PUBLIC CONTACT FORM ---
window.submitContact = async function(btn) {
  const name = document.getElementById('contact-name')?.value?.trim();
  const email = document.getElementById('contact-email')?.value?.trim();
  const subject = document.getElementById('contact-subject')?.value;
  const message = document.getElementById('contact-msg')?.value?.trim();

  if (!name || !email || !message) {
    toast('Please fill in all fields', false);
    return;
  }

  const orig = btn.textContent;
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const { error } = await supabase.from('contact_messages').insert([{ name, email, subject, message }]);
    if (error) throw error;

    toast('? Message sent! We will contact you soon.', true);
    document.getElementById('contact-name').value = '';
    document.getElementById('contact-email').value = '';
    document.getElementById('contact-msg').value = '';
  } catch (err) {
    console.error('Contact Error:', err);
    toast('? Error sending message. Please try again.', false);
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
};

window.waContact = function() {
  const num = '254753348298';
  const msg = encodeURIComponent('Hello Marsha Rentals, I would like to make an enquiry regarding your listings.');
  window.open('https://wa.me/' + num + '?text=' + msg, '_blank');
};

// --- HELPER: IMAGE PREVIEW ---
window.handleImagePreview = function(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = '';
  if (input.files) {
    Array.from(input.files).slice(0, 6).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        img.style.border = '1px solid var(--g200)';
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }
};

// --- PUBLIC DATA ENGINE (Supabase Sync) ---

window.renderAllListings = async function() {
  try {
    const pgrid = document.getElementById('pgrid-main');
    if (!pgrid) return;

    // 1. Fetch total count
    const { count, error: cErr } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'Available');
    if (!cErr) {
        if(document.getElementById('prop-count-header')) document.getElementById('prop-count-header').textContent = count || 0;
    }

    // 2. Fetch first 6 listings (Initial batch)
    const { data: listings, error } = await supabase.from('listings')
        .select('*')
        .eq('status', 'Available')
        .order('created_at', { ascending: false })
        .limit(6);
    
    if (error) throw error;

    if (!listings || listings.length === 0) {
        pgrid.innerHTML = `<div style='grid-column:1/-1;text-align:center;padding:60px;color:var(--g500);'>
          <div style='font-size:40px;margin-bottom:15px;'>🔍</div>
          <h3 style="color:var(--g800);">No listings found</h3>
          <p>We're currently updating our catalog. Check back soon!</p>
        </div>`;
        if(document.getElementById('load-more-status')) document.getElementById('load-more-status').textContent = 'Showing 0 properties';
    } else {
        pgrid.innerHTML = listings.map(l => `
          <div class='pcard' onclick='window.viewPropertyDetails("${l.id}")'>
            <div class='pthumb' style='background: url("${l.image_url || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&q=80&w=800'}") center/cover no-repeat;'>
              <div class='pavail'><span class='badge bg'>Available</span></div>
            </div>
            <div class='pinfo'>
              <div class='pprice'>KSh ${(l.price || 0).toLocaleString()}/mo</div>
              <div class='ploc'>📍 ${l.location || 'Naivasha'}</div>
              <div class='ptitle' style='font-size:14px;font-weight:600;margin:4px 0;'>${l.title}</div>
              <button class='btn bp bsm' style='width:100%;margin-top:8px'>View details</button>
            </div>
          </div>`).join('');
        
        if(document.getElementById('load-more-status')) document.getElementById('load-more-status').textContent = `Showing ${listings.length} of ${count || 0} properties`;
    }
  } catch (err) {
    console.error('Public Sync Error:', err);
  }
};

window.loadMoreProps = async function(btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';
    toast('⏳ Loading more properties...', true);
    
    // Fetch all available for this demo (simple pagination replacement)
    const { data: all, count: totalCount, error } = await supabase.from('listings').select('*', { count: 'exact' }).eq('status', 'Available');
    if (all) {
        const pgrid = document.getElementById('pgrid-main');
        pgrid.innerHTML = all.map(l => `
          <div class='pcard' onclick='window.viewPropertyDetails("${l.id}")'>
            <div class='pthumb' style='background: url("${l.image_url || 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&q=80&w=800'}") center/cover no-repeat;'>
              <div class='pavail'><span class='badge bg'>Available</span></div>
            </div>
            <div class='pinfo'>
              <div class='pprice'>KSh ${(l.price || 0).toLocaleString()}/mo</div>
              <div class='ploc'>📍 ${l.location || 'Naivasha'}</div>
              <div class='ptitle' style='font-size:14px;font-weight:600;margin:4px 0;'>${l.title}</div>
              <button class='btn bp bsm' style='width:100%;margin-top:8px'>View details</button>
            </div>
          </div>`).join('');
        
        if(document.getElementById('load-more-status')) document.getElementById('load-more-status').textContent = `Showing ${all.length} of ${totalCount || 0} properties (All properties loaded)`;
        toast(`✅ Loaded all ${all.length} properties!`, true);
    }
    btn.disabled = false;
    btn.textContent = 'Load more properties';
};

window.viewPropertyDetails = async function(id) {
    if(!id) return;
    toast('🔍 Loading property details...', true);
    
    try {
        let p = null;
        // Try fetch with profile join first
        const { data: d1, error: e1 } = await supabase
            .from('listings')
            .select('*, profiles!listings_landlord_id_fkey(*)')
            .eq('id', id)
            .single();

        if(!e1 && d1) p = d1;
        else {
            console.warn('View Fetch Try 1 Failed:', e1);
            const { data: d2, error: e2 } = await supabase.from('listings').select('*, profiles(*)').eq('id', id).single();
            if (e2) {
                const { data: d3, error: e3 } = await supabase.from('listings').select('*').eq('id', id).single();
                if(e3) throw new Error('Property not found');
                p = d3;
            } else {
                p = d2;
            }
        }

        // Populate Detail Page with real data
        const bread = document.getElementById('dtl-bread-title');
        const title = document.getElementById('dtl-title');
        const loc = document.getElementById('dtl-loc');
        const locSub = document.getElementById('dtl-loc-sub');
        const price = document.getElementById('dtl-price');
        const dep = document.getElementById('dtl-dep');
        const desc = document.getElementById('dtl-desc');
        const bRent = document.getElementById('dtl-book-rent');
        const bDep = document.getElementById('dtl-book-dep');
        const bTotal = document.getElementById('dtl-book-total');
        const lName = document.getElementById('dtl-l-name');
        const lInit = document.getElementById('dtl-l-init');
        const mainImg = document.getElementById('dtl-img-main');
        const mapLink = document.getElementById('dtl-map-link');

        const ksh = (val) => 'KSh ' + (val || 0).toLocaleString();

        if (bread) bread.textContent = p.title || p.name;
        if (title) title.textContent = p.title || p.name;
        if (loc) loc.textContent = '📍 ' + (p.location || 'Location Pending');
        if (locSub) locSub.textContent = p.location || 'Property Location';
        if (mapLink && p.location) mapLink.href = 'https://maps.google.com/maps?q=' + encodeURIComponent(p.location);
        if (price) price.innerHTML = ksh(p.price) + '<span style="font-size:15px;font-weight:400;">/mo</span>';
        if (dep) dep.textContent = ksh(p.price * 2) + ' (2 months)';
        if (desc) desc.textContent = p.description || `Beautiful ${p.type || 'property'} located in the heart of ${p.location || 'the area'}. Perfect for a modern lifestyle.`;
        
        if (bRent) bRent.textContent = ksh(p.price);
        if (bDep) bDep.textContent = ksh(p.price * 2);
        if (bTotal) bTotal.textContent = ksh(p.price * 3);

        if (lName) lName.textContent = p.profiles?.name || 'Landlord';
        if (lInit) lInit.textContent = (p.profiles?.name || 'L').charAt(0).toUpperCase();

        if (mapLink) {
            const locQuery = encodeURIComponent(p.location || '');
            mapLink.href = `https://www.google.com/maps/search/?api=1&query=${locQuery}`;
        }
        if (mainImg) {
            if (p.image_url) {
                mainImg.style.backgroundImage = `url('${p.image_url}')`;
                mainImg.textContent = '';
            } else {
                mainImg.style.backgroundImage = 'linear-gradient(135deg,#B5D4F4,#E6F1FB)';
                mainImg.textContent = '🏢';
            }
        }

        gto('detail'); // Switch to detail page
        window.scrollTo(0,0);
    } catch (err) {
        toast('❌ Error: ' + err.message, false);
    }
};

// --- LANDLORD ACTION ENGINES ---

window.saveProfile = async function(btn) {
    const name = document.getElementById('l-set-name').value;
    const phone = document.getElementById('l-set-phone').value;
    const mpesa = document.getElementById('l-set-mpesa').value;
    
    if (!name) { toast('Please enter your name', false); return; }
    
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase.from('profiles').update({
            name: name,
            phone: phone,
            mpesa_no: mpesa,
            role: 'Landlord' // Ensure role stays consistent
        }).eq('id', user.id);

        if (error) throw error;
        
        toast('✅ Profile saved successfully!', true);
        if (typeof fetchLandlordData === 'function') fetchLandlordData();
    } catch (err) {
        toast('❌ Error: ' + err.message, false);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save profile';
    }
};

window.lRecordPayment = async function() {
    toast('💾 Feature: Saving payment record...', true);
    // Future: Supabase insert into payments table
};

window.deleteDoc = async function(id) {
    if(!confirm('🗑️ Delete this document?')) return;
    try {
        const { error } = await supabase.from('documents').delete().eq('id', id);
        if(error) throw error;
        toast('🗑️ Document deleted', true);
        
        const { data: { session } } = await supabase.auth.getSession();
        if(session && session.user) hydrateUserDashboards(session.user);
    } catch(err) {
        toast('❌ Delete Error: ' + err.message, false);
    }
};

window.viewDoc = async function(id) {
    try {
        const { data: doc, error } = await supabase.from('documents').select('*').eq('id', id).single();
        if(error || !doc) throw new Error('Document not found');

        if(doc.url && !doc.url.includes('placeholder.com')) {
            window.open(doc.url, '_blank');
        } else {
            // Professional modal view for documents without external links yet
            showModal('View Document: ' + doc.name,
                `<div style="text-align:center;padding:20px;">
                    <div style="font-size:64px;margin-bottom:20px;">📄</div>
                    <h3 style="margin-bottom:10px;">${doc.name}</h3>
                    <p style="color:var(--g500);font-size:14px;margin-bottom:20px;">This file is safely stored in Marshal Rentals Cloud.</p>
                    <div style="background:var(--g50);padding:15px;border-radius:12px;text-align:left;">
                        <div style="font-size:12px;font-weight:600;color:var(--g500);text-transform:uppercase;margin-bottom:8px;">File Details</div>
                        <div style="font-size:14px;"><strong>Category:</strong> ${doc.category || 'Uploaded File'}</div>
                        <div style="font-size:14px;"><strong>Size:</strong> ${doc.size || 'FILE'}</div>
                        <div style="font-size:14px;"><strong>Uploaded:</strong> ${new Date(doc.created_at).toLocaleDateString()}</div>
                        <div style="font-size:14px;"><strong>Status:</strong> <span class="badge ${doc.status === 'Active' ? 'bg' : 'ba'}">${doc.status}</span></div>
                    </div>
                </div>`,
                `<button class="btn bs" style="flex:1;" onclick="cmsCloseModal()">Close Viewer</button>`
            );
        }
    } catch(err) {
        toast('❌ Viewer Error: ' + err.message, false);
    }
};

window.editDoc = async function(id) {
    try {
        const { data: doc, error } = await supabase.from('documents').select('*').eq('id', id).single();
        if(error || !doc) return;

        const newStatus = doc.status === 'Active' ? 'Inactive' : 'Active';
        if(!confirm(`Toggle document status to ${newStatus}?`)) return;

        const { error: uErr } = await supabase.from('documents').update({ status: newStatus }).eq('id', id);
        if(uErr) throw uErr;

        toast('✅ Document status updated', true);
        
        // Auto-refresh the dashboard
        const { data: { session } } = await supabase.auth.getSession();
        if(session && session.user) hydrateUserDashboards(session.user);
    } catch(err) {
        toast('❌ Update Error: ' + err.message, false);
    }
};

window.lViewPayment = async function(id) {
    const { data: p, error } = await supabase.from('payments').select('*').eq('id', id).single();
    if(error) return;
    
    showModal('Payment Details', `
        <div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
            <p><strong>Ref:</strong> PAY-00${p.id.toString().slice(0,4)}</p>
            <p><strong>Amount:</strong> KSh ${(p.amount || 0).toLocaleString()}</p>
            <p><strong>Method:</strong> ${p.method}</p>
            <p><strong>Code:</strong> ${p.ref_code || 'N/A'}</p>
            <p><strong>Date:</strong> ${new Date(p.created_at).toLocaleString()}</p>
        </div>
    `);
};

window.lViewMaint = async function(id) {
    const { data: m, error } = await supabase.from('maintenance').select('*').eq('id', id).single();
    if(error) return;
    
    showModal('Maintenance Update', `
        <div style='text-align:left;'>
            <p><strong>Issue:</strong> ${m.issue_description}</p>
            <p><strong>Status:</strong> <span class="badge ba">${m.status}</span></p>
            <div style="margin-top:15px;">
                <label style="font-size:12px;font-weight:600;">Update Status</label>
                <select id="m-up-status" style="width:100%;padding:10px;margin-top:5px;border-radius:6px;border:1.5px solid #eee;">
                    <option ${m.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option ${m.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option ${m.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                </select>
                <button class="btn bg-btn" style="width:100%;margin-top:10px;" onclick="lSaveMaintStatus('${id}')">Save Changes</button>
            </div>
        </div>
    `);
};

window.lSaveMaintStatus = async function(id) {
    const status = document.getElementById('m-up-status').value;
    try {
        const { error } = await supabase.from('maintenance').update({ status }).eq('id', id);
        if(error) throw error;
        toast('✅ Request updated', true);
        cmsCloseModal();
        if (typeof fetchLandlordData === 'function') fetchLandlordData();
    } catch(err) {
        toast('❌ Error: ' + err.message, false);
    }
};

window.lViewTenant = function(name) {
    showModal('Tenant Details', `
        <div style='text-align:left;line-height:2;font-size:14px;color:var(--g500);'>
            <p><strong>Name:</strong> ${name || 'Grace Wanjiku'}</p>
            <p><strong>Contact:</strong> +254 753 348 298</p>
            <p><strong>Joined:</strong> ${new Date().toLocaleDateString()}</p>
            <hr style="border:0;border-top:1px solid #eee;margin:10px 0;">
            <p style="font-size:12px;">This profile is verified and active.</p>
        </div>
    `);
};

window.waTenant = function(phone, name) {
    const msg = encodeURIComponent(`Hi ${name}, this is your landlord from Marshal Rentals.`);
    window.open(`https://wa.me/${phone.replace('+','')}/?text=${msg}`, '_blank');
};

// Initial Load
renderAllListings();

window.fetchHeroStats = async function() {
  try {
    const { count: lCount } = await supabase.from('listings').select('*', { count: 'exact', head: true });
    const { count: tCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Tenant');
    const { count: ldCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Landlord');

    const eL = document.getElementById('hstat-listings');
    const eT = document.getElementById('hstat-tenants');
    const eLD = document.getElementById('hstat-landlords');

    if (eL) eL.textContent = (lCount || 0) + '+';
    if (eT) eT.textContent = (tCount || 0) + '+';
    if (eLD) eLD.textContent = (ldCount || 0) + '+';
  } catch (err) {
    console.warn('Stats Fetch Error:', err);
  }
};

fetchHeroStats();

/**
 * ========================================================
 * ADMINISTRATIVE IDENTITY & SITE CONFIGURATION ENGINE
 * ========================================================
 */

// Load Site Settings from Supabase
window.fetchSiteConfig = async function() {
    try {
        const { data, error } = await supabase.from('platform_settings').select('*').limit(1).single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'not found'

        // Also fetch CMS Office Address from site_content table
        const { data: cmsData } = await supabase.from('site_content').select('address').limit(1).single();
        const officeAddr = cmsData?.address || 'Naivasha CBD, Nakuru County, Kenya';
        
        if (data) {
            // Hydrate Admin Setting Inputs if they exist
            const nInp = document.getElementById('a-cfg-name');
            const eInp = document.getElementById('a-cfg-email');
            const wInp = document.getElementById('a-cfg-whatsapp');
            
            if(nInp) nInp.value = data.platform_name || 'Marshal Rentals';
            if(eInp) eInp.value = data.admin_email || 'admin@marshalrentals.co.ke';
            if(wInp) wInp.value = data.whatsapp_number || '+254 753 348 298';
            const aInp = document.getElementById('a-cfg-address');
            if(aInp) aInp.value = officeAddr;

            // Global DOM Hydration (Update title tags, footers, etc.)
            document.title = data.platform_name || 'Marshal Rentals';
            document.querySelectorAll('.site-brand-name').forEach(el => el.textContent = data.platform_name || 'Marshal Rentals');
            
            // Site Footers & Contact Hydration
            if (data.admin_email) {
                if (document.getElementById('cms-footer-email')) document.getElementById('cms-footer-email').textContent = '✉️ ' + data.admin_email;
                if (document.getElementById('cms-contact-email')) document.getElementById('cms-contact-email').textContent = data.admin_email;
            }
            if (data.whatsapp_number) {
                if (document.getElementById('cms-footer-phone')) document.getElementById('cms-footer-phone').textContent = '📞 ' + data.whatsapp_number;
                if (document.getElementById('cms-contact-phone')) document.getElementById('cms-contact-phone').textContent = data.whatsapp_number;
            }

            // Hydrate Office Address Globally
            if (officeAddr) {
                if (document.getElementById('cms-footer-address')) document.getElementById('cms-footer-address').textContent = '📍 ' + officeAddr;
                if (document.getElementById('cms-contact-address')) document.getElementById('cms-contact-address').textContent = officeAddr;
            }

            window.SITE_WHATSAPP = data.whatsapp_number || '+254 753 348 298';
            window.SITE_EMAIL = data.admin_email || 'admin@marshalrentals.co.ke';
        }
    } catch (err) {
        console.warn('Site Identity Sync Error:', err);
    }
};

// Save Site Settings to Supabase
window.aSaveSettings = async function(btn) {
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = 'Saving...';
    }
    
    try {
        const pName = document.getElementById('a-cfg-name')?.value?.trim();
        const pEmail = document.getElementById('a-cfg-email')?.value?.trim();
        const pWa = document.getElementById('a-cfg-whatsapp')?.value?.trim();
        const pAddr = document.getElementById('a-cfg-address')?.value?.trim();
        const pCurr = document.getElementById('a-cfg-currency')?.value;

        // Upsert strategy using ID 1
        const payload = { 
            id: 1, 
            platform_name: pName, 
            admin_email: pEmail, 
            whatsapp_number: pWa,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('platform_settings').upsert(payload, { onConflict: 'id' });
        if (error) throw error;

        // Parallel save for Office Address to CMS (site_content) if it exists
        if (pAddr) {
            await supabase.from('site_content').upsert({ id: 1, address: pAddr }, { onConflict: 'id' });
        }
        
        toast('✅ Settings successfully updated!', true);
        fetchSiteConfig(); // Immediately hydrate the UI with the newly synchronized data
        
    } catch (err) {
        toast('❌ Sync Error: ' + err.message, false);
        console.error('Settings Auto-Sync Failed:', err);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = 'Save settings';
        }
    }
};

// Initialize Site Identity on load
setTimeout(fetchSiteConfig, 500);

/**
 * ========================================================
 * CONTENT MANAGEMENT SYSTEM (CMS) ENGINE
 * ========================================================
 */

window.fetchCMSConfig = async function() {
    try {
        const { data, error } = await supabase.from('site_content').select('*').limit(1).single();
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
            // Hydrate CMS Inputs if they exist
            const ids = ['email', 'phone', 'address', 'types', 'locations', 'hero-headline', 'hero-sub', 'blog-title', 'blog-url'];
            ids.forEach(id => {
                const el = document.getElementById('cms-cfg-' + id);
                // Map the ID format to the expected database column name
                const colName = id.replace(/-/g, '_');
                if (el && data[colName]) {
                    el.value = data[colName];
                }
            });

            // Global DOM Hydration (Update Support numbers, hero text, blog links globally)
            document.querySelectorAll('.cms-hero-headline').forEach(el => el.textContent = data.hero_headline || 'Find your perfect home in Kenya.');
            document.querySelectorAll('.cms-hero-sub').forEach(el => el.textContent = data.hero_sub || 'Discover thousands of rental properties curated for you. The smartest way to rent.');
            document.querySelectorAll('.cms-support-email').forEach(el => { el.textContent = data.email || ''; el.href = 'mailto:' + (data.email || ''); });
            document.querySelectorAll('.cms-support-phone').forEach(el => { el.textContent = data.phone || ''; el.href = 'tel:' + (data.phone || ''); });
        }
    } catch (err) {
        console.warn('CMS Sync Error:', err);
    }
};

window.aSaveCMS = async function(btn) {
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = 'Saving...';
    }
    
    try {
        const payload = { id: 1, updated_at: new Date().toISOString() };
        
        // Dynamically build payload from the CMS inputs
        const ids = ['email', 'phone', 'address', 'types', 'locations', 'hero-headline', 'hero-sub', 'blog-title', 'blog-url'];
        ids.forEach(id => {
            const el = document.getElementById('cms-cfg-' + id);
            if (el) {
                payload[id.replace(/-/g, '_')] = el.value.trim();
            }
        });

        const { error } = await supabase.from('site_content').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        
        toast('✅ Content successfully updated!', true);
        fetchCMSConfig(); // Refetch to instantly hydrate UI
        
    } catch (err) {
        toast('❌ CMS Sync Error: ' + err.message, false);
        console.error('CMS Auto-Sync Failed:', err);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = 'Save Content';
        }
    }
};
/**
 * ========================================================
 * ADMINISTRATIVE ANALYTICS ENGINE (DYNAMIC OCCUPANCY)
 * ========================================================
 */

window.initAAnalytics = async function() {
    try {
        const { data, error } = await supabase.from('listings').select('location, status');
        if (error) throw error;
        
        // Define targeted zones for analytics
        const zones = {
            'naivasha': 'Naivasha CBD',
            'nakuru': 'Nakuru Town',
            'kongoni': 'Kongoni',
            'hells': "Hell's Gate",
            'maai': 'Maai Mahiu'
        };

        const stats = {};
        for(let key in zones) stats[key] = { total: 0, occ: 0 };
        
        // Aggregate property data
        (data || []).forEach(l => {
            if(!l.location) return;
            for(let key in zones) {
                if(l.location.toLowerCase().includes(zones[key].toLowerCase().split(' ')[0])) {
                    stats[key].total++;
                    if(l.status === 'Occupied') stats[key].occ++;
                    break;
                }
            }
        });

        // Hydrate DOM analytics
        for(let key in zones) {
            const spanText = document.getElementById('a-occ-' + key);
            const barDom = document.getElementById('a-bar-' + key);
            
            let percentage = 0;
            if(stats[key].total > 0) {
                percentage = Math.round((stats[key].occ / stats[key].total) * 100);
            }
            
            if(spanText) spanText.textContent = percentage + '%';
            if(barDom) barDom.style.width = percentage + '%';
        }
        
    } catch (err) {
        console.error('Analytics Hydration Failed:', err);
    }
};
// Initialize CMS on load
setTimeout(fetchCMSConfig, 500);

/**
 * ========================================================
 * MASTER DASHBOARD HYDRATION ENGINE (NO MORE DEMO DATA)
 * ========================================================
 */

window.hydrateUserDashboards = async function(sessionUser) {
    if(!sessionUser) return;
    
    // --- ELITE ACCESS PROTOCOL (Strict Email Enforcement) ---
    const ADMIN_EMAIL = 'david.m.macharia12@gmail.com';
    const LANDLORD_EMAIL = 'david.macharia662@gmail.com';
    const userEmail = (sessionUser.email || '').toLowerCase();
    
    let uMeta = sessionUser.user_metadata || {};
    let role = (uMeta.role || 'Tenant').toLowerCase();

    // ⛔ SECURITY GATE: Force Tenants back if they attempt unauthorized role access
    if (role === 'admin' && userEmail !== ADMIN_EMAIL) {
        console.warn('⚠️ Unauthorized Admin access attempt from:', userEmail);
        role = 'tenant'; // Force downgrade for this session
    }
    if (role === 'landlord' && userEmail !== LANDLORD_EMAIL) {
        console.warn('⚠️ Unauthorized Landlord access attempt from:', userEmail);
        role = 'tenant'; // Force downgrade for this session
    }

    try {
        if (role === 'tenant') {
            // 1. Hydrate Tenant Stats
            const { data: maint } = await supabase.from('maintenance').select('*').eq('tenant_id', sessionUser.id);
            const mCount = maint ? maint.filter(m => m.status === 'Pending').length : 0;
            const mT = document.getElementById('t-stat-maint');
            if(mT) mT.textContent = mCount > 0 ? mCount + ' Active' : 'None';

            const { data: pmts } = await supabase.from('payments').select('*').eq('tenant_id', sessionUser.id);
            const pendingPmt = pmts ? pmts.filter(p => p.status === 'Pending').length : 0;
            const pT = document.getElementById('t-stat-rent');
            if(pT) pT.textContent = pendingPmt > 0 ? 'Due soon' : 'Up to date';

            // 2. Render Tenant Maintenance List (Premium Row Style)
            const tMaintList = document.getElementById('t-maint-list');
            if(tMaintList && maint) {
                if(maint.length === 0) {
                    tMaintList.innerHTML = `<div style="text-align:center;padding:80px;color:var(--g500);">
                        <div style="font-size:48px;margin-bottom:15px;">🔧</div>
                        <h3>No maintenance requests</h3>
                        <p>Submit a request above if you need repairs.</p>
                    </div>`;
                } else {
                    tMaintList.innerHTML = maint.map(m => `
                        <div class="rrow" style="background:#fff;padding:15px;border-radius:12px;margin-bottom:10px;border:1px solid var(--g100);display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                            <div style="display:flex;gap:15px;align-items:center;">
                                <div class="ric" style="background:#FCEBEB;width:40px;height:40px;">🔧</div>
                                <div>
                                    <div style="font-size:14px;font-weight:600;color:var(--g800);">${m.issue || m.description}</div>
                                    <div style="font-size:11px;color:var(--g500);">${new Date(m.created_at).toLocaleDateString()} · ${m.type || 'Request'}</div>
                                </div>
                            </div>
                            <span class="badge ${m.status === 'In Progress' ? 'ba' : (m.status === 'Resolved' ? 'bg' : 'bb')}">${m.status}</span>
                        </div>`).join('');
                }
            }

            // 3. Render Tenant Payment History
            const tPmtList = document.getElementById('t-payment-history-list');
            if(tPmtList && pmts) {
                if(pmts.length === 0) {
                    tPmtList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--g500);"><div style="font-size:32px;margin-bottom:10px;">💳</div><div>No payment records yet</div></div>`;
                } else {
                    tPmtList.innerHTML = pmts.map(p => `
                        <div class="rrow">
                            <div class="ric" style="background:${p.status === 'Paid' ? '#E1F5EE' : '#FCEBEB'};">${p.status === 'Paid' ? '💰' : '💳'}</div>
                            <div style="flex:1;">
                                <div style="font-size:13px;font-weight:500;">KSh ${(p.amount || 0).toLocaleString()}</div>
                                <div style="font-size:11px;color:var(--g500);">${new Date(p.created_at).toLocaleDateString()} · ${p.method || 'M-Pesa'}</div>
                            </div>
                            <span class="badge ${p.status === 'Paid' ? 'bg' : 'ba'}">${p.status}</span>
                        </div>`).join('');
                }
            }

            // 4. Render Tenant Documents List (Premium Row Style)
            const tDocBody = document.getElementById('t-doc-tbody'); // Note: if using table, we might need a div-list instead. 
            // In index.html line 2869 it is a tbody. I will check if I should change it to a div list for better styling.
            if(tDocBody) {
                const { data: docs } = await supabase.from('documents').select('*').eq('tenant_id', sessionUser.id);
                const tWrap = document.getElementById('t-doc-tbody-wrap'); 
                if(tWrap && docs) {
                   if(docs.length === 0) {
                       tDocBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:60px;color:var(--g500);">
                         <div style="font-size:40px;margin-bottom:10px;">📄</div>
                         <h3>No documents yet</h3>
                         <p>Your lease and receipts will appear here.</p>
                       </td></tr>`;
                   } else {
                       // We can stick to table if styled well, or convert to rows. 
                       // User screenshot looks like a table-less list, but table is fine if rows are styled.
                       tDocBody.innerHTML = docs.map(d => `
                        <tr>
                            <td><div class="ric" style="background:#FCEBEB;">📄</div></td>
                            <td>
                                <div style="font-weight:600;font-size:14px;color:var(--g800);">${d.name}</div>
                                <div style="font-size:11px;color:var(--g500);">${d.category || 'Tenant Upload'}</div>
                            </td>
                            <td style="font-size:12px;color:var(--g500);">${d.size || 'PDF'} · ${new Date(d.created_at).toLocaleDateString()}</td>
                            <td><span class="badge ${d.status === 'Active' ? 'bg' : (d.status === 'Receipt' ? 'bb' : 'ba')}">${d.status}</span></td>
                            <td><button class="btn bs bxs" style="padding:6px 12px;font-size:11px;" onclick="docDownload('${d.id}')">Download</button></td>
                        </tr>`).join('');
                   }
                }
            }

            // 5. Render Tenant Saved Properties (Pulling real listings for discover)
            const tSavedList = document.getElementById('t-saved-list');
            if(tSavedList) {
                const { data: savedProps } = await supabase.from('listings').select('*').limit(3);
                if(savedProps && savedProps.length > 0) {
                    const tSavedCountText = document.getElementById('t-saved-count-text');
                    if(tSavedCountText) tSavedCountText.textContent = `Saved properties (${savedProps.length})`;
                    
                    tSavedList.innerHTML = savedProps.map(p => `
                        <div class="pcard" onclick="viewPropertyDetails('${p.id}')">
                            <div class="pthumb" style="${p.image_url ? `background-image: url('${p.image_url}'); background-size: cover;` : ''}">
                                <div class="pavail"><span class="badge ${p.status === 'Available' ? 'bg' : (p.status === 'Occupied' ? 'ba' : 'br')}">${p.status}</span></div>
                            </div>
                            <div class="pinfo">
                                <div class="pprice">KSh ${(p.price || 0).toLocaleString()}/mo</div>
                                <div class="ploc">📍 ${p.location}</div>
                                <button class="btn bp bsm" style="width:100%;margin-top:7px;">View</button>
                            </div>
                        </div>`).join('');
                }
            }
        } else if(role === 'landlord') {
            // 2. Hydrate Landlord Stats
            const { data: lprops } = await supabase.from('listings').select('*').eq('landlord_id', sessionUser.id);
            const myProps = lprops || [];
            
            const eProps = document.getElementById('l-stat-props');
            if(eProps) eProps.textContent = myProps.length;

            const { data: mData } = await supabase.from('maintenance').select('*');
            const myMaintCount = (mData || []).length; 
            const eMaint = document.getElementById('l-stat-maint');
            if(eMaint) eMaint.textContent = myMaintCount + ' Active';

            const eRev = document.getElementById('l-stat-rev');
            if(eRev) {
                const totalRev = myProps.reduce((sum, p) => sum + (p.price || 0), 0);
                eRev.textContent = 'KSh ' + totalRev.toLocaleString();
            }

            const eTenants = document.getElementById('l-stat-tenants');
            if(eTenants) {
                const occ = myProps.filter(p => p.status === 'Occupied').length;
                eTenants.textContent = occ;
            }

            // 3. Render Landlord Property List
            const lGrid = document.getElementById('l-props-list');
            if(lGrid && myProps) {
                const lpCountText = document.getElementById('l-props-count-text');
                if(lpCountText) lpCountText.textContent = `My properties (${myProps.length})`;
                
                if(myProps.length === 0) {
                    lGrid.innerHTML = `<div style="text-align:center;padding:80px;color:var(--g500);background:#fff;border-radius:var(--rmd);border:1.5px dashed var(--g200);"><div style="font-size:48px;margin-bottom:15px;">🏗️</div><h3>No properties yet</h3><p>Assign your first rental property.</p><button class="btn bg-btn" onclick="lAddProperty()">+ Add my first property</button></div>`;
                } else {
                    lGrid.innerHTML = myProps.map(p => `
                        <div class="rrow" style="background:#fff;padding:15px;border-radius:10px;margin-bottom:10px;border:1px solid var(--g200);display:flex;justify-content:space-between;align-items:center;">
                            <div style="display:flex;gap:15px;align-items:center;">
                                <div style="width:50px;height:50px;border-radius:8px;background:#f0f0f0 url('${p.image_url}') center/cover;"></div>
                                <div>
                                    <div style="font-weight:600;">${p.title || p.name}</div>
                                    <div style="font-size:12px;color:var(--g500);">📍 ${p.location} · <span class="badge ${p.status === 'Available' ? 'bg' : (p.status === 'Occupied' ? 'ba' : 'br')}" style="font-size:9px;padding:2px 6px;">${p.status}</span></div>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:700;color:var(--blue);">KSh ${(p.price || 0).toLocaleString()}</div>
                                <div style="display:flex;gap:5px;margin-top:5px;">
                                    <button class="btn bs bxs" onclick="viewPropertyDetails('${p.id}')">View</button>
                                    <button class="btn bs bxs" onclick="lEditProperty('${p.id}')">Edit</button>
                                </div>
                            </div>
                        </div>`).join('');
                }
            }

            // 5. Render Landlord Maintenance Overviews & Selects
            const lMaintList = document.getElementById('l-maint-list');
            const lMaintSelect = document.getElementById('l-maint-select');
            const { data: allMaint } = await supabase.from('maintenance').select('*');
            
            if(allMaint) {
                // Populate the "Update a request" dropdown
                if(lMaintSelect) {
                    lMaintSelect.innerHTML = `<option value="">- Select a request -</option>` + allMaint.map(m => `
                        <option value="${m.id}">${m.issue || m.description} — ${m.status}</option>`).join('');
                }

                // Populate the Table of requests
                if(lMaintList) {
                    if(allMaint.length === 0) {
                        lMaintList.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--g500);">No maintenance requests found.</td></tr>`;
                    } else {
                        lMaintList.innerHTML = allMaint.map(m => `
                            <tr>
                                <td><div class="ric" style="background:#FCEBEB;">🔧</div></td>
                                <td><div style="font-weight:500;">${m.issue}</div><div style="font-size:11px;color:var(--g500);">${new Date(m.created_at).toLocaleDateString()}</div></td>
                                <td><span class="badge ${m.urgency === 'High' ? 'ba' : 'bb'}">${m.urgency}</span></td>
                                <td><span class="badge ${m.status === 'Resolved' ? 'bg' : 'ba'}">${m.status}</span></td>
                                <td><button class="btn bs bxs" onclick="viewMaint('${m.id}')">View</button></td>
                            </tr>`).join('');
                    }
                }
            }

            // 6. Render Landlord Tenant Documents
            const lDocBody = document.getElementById('l-doc-tbody');
            if(lDocBody) {
                const { data: lDocs } = await supabase.from('documents').select('*');
                if(!lDocs || lDocs.length === 0) {
                    lDocBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--g500);">No tenant documents found.</td></tr>`;
                } else {
                    lDocBody.innerHTML = lDocs.map(d => `
                        <tr>
                            <td><div class="ric" style="background:#E1F5EE;">📄</div></td>
                            <td><div style="font-weight:600;font-size:14px;">${d.name}</div><div style="font-size:11px;color:var(--g500);">${d.category || 'Uploaded File'}</div></td>
                            <td style="font-size:12px;color:var(--g500);">${d.size || 'PDF'} · ${new Date(d.created_at).toLocaleDateString()}</td>
                            <td><span class="badge ${d.status === 'Active' ? 'bg' : 'ba'}">${d.status}</span></td>
                            <td>
                                <div style="display:flex;gap:5px;">
                                    <button class="btn bs bxs" style="padding:4px 8px;font-size:10px;" onclick="viewDoc('${d.id}')">View</button>
                                    <button class="btn bs bxs" style="padding:4px 8px;font-size:10px;" onclick="editDoc('${d.id}')">Edit</button>
                                    <button class="btn bs bxs" style="padding:4px 8px;font-size:10px;color:var(--red);" onclick="deleteDoc('${d.id}')">Del</button>
                                </div>
                            </td>
                        </tr>`).join('');
                }
            }
        }
    } catch (err) {
        console.warn('Dashboard Hydration Pipeline Error:', err);
    }
};

// Global Auth Listener to dynamically wipe demo data on login/refresh
supabase.auth.onAuthStateChange((event, session) => {
    if(session && session.user) {
        // Fire asynchronously to avoid blocking UI thread during auth transitions
        console.log('Auth State Change:', event, session.user.email);
        setTimeout(() => hydrateUserDashboards(session.user), 1500);
    }
});

// Initial load check
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if(session && session.user) {
        console.log('Initial Session Found:', session.user.email);
        hydrateUserDashboards(session.user);
    }
})();
