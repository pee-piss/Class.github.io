// SUBJECT TAGS
    const SUBJECT_TAGS = [
      { id: 'toan', name: 'Toán', icon: '📐', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
      { id: 'van', name: 'Văn', icon: '📖', color: '#D97706', bg: 'rgba(217, 119, 6, 0.12)' },
      { id: 'tieng-anh', name: 'Tiếng Anh', icon: '🌍', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },
      { id: 'tin-hoc', name: 'Tin học', icon: '💻', color: '#4F46E5', bg: 'rgba(79, 70, 229, 0.12)' },
      { id: 'cong-nghe', name: 'Công nghệ', icon: '⚙️', color: '#0D9488', bg: 'rgba(13, 148, 136, 0.12)' },
      { id: 'lich-su', name: 'Lịch sử', icon: '🏛️', color: '#B45309', bg: 'rgba(180, 83, 9, 0.12)' },
      { id: 'dia-ly', name: 'Địa lý', icon: '🗺️', color: '#0284C7', bg: 'rgba(2, 132, 199, 0.12)' },
      { id: 'sinh', name: 'Sinh', icon: '🧬', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.12)' },
      { id: 'gdcd', name: 'Giáo dục công dân', icon: '⚖️', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },
      { id: 'my-thuat', name: 'Mỹ thuật', icon: '🎨', color: '#DB2777', bg: 'rgba(219, 39, 119, 0.12)' },
      { id: 'am-nhac', name: 'Âm nhạc', icon: '🎵', color: '#9333EA', bg: 'rgba(147, 51, 234, 0.12)' },
      { id: 'meme', name: 'Meme', icon: '😂', color: '#EA580C', bg: 'rgba(234, 88, 12, 0.12)' },
      { id: 'ki-niem', name: 'Kỉ niệm', icon: '📸', color: '#E11D48', bg: 'rgba(225, 29, 72, 0.12)' },
      { id: 'hoi-dap', name: 'Hỏi đáp', icon: '❓', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.12)' }
    ];

    const COVER_PRESETS = {
      orange: 'linear-gradient(135deg, #FF4500 0%, #FF8C00 100%)',
      blue: 'linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)',
      purple: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
      green: 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
    };

    const STORAGE_KEYS = {
      USERS: '9a3_v3_users',
      SESSION: '9a3_v3_session',
      POSTS: '9a3_v3_posts',
      NOTIFS: '9a3_v3_notifs',
      THEME: '9a3_v3_theme',
      CLOUD_URL: '9a3_v3_cloud_url'
    };

    // DEFAULT CLOUD BACKEND URL (USER CAN ALSO SET THEIR OWN FIREBASE DB URL IN UI)
    const DEFAULT_CLOUD_URL = 'https://class-9a3-anchau-default-rtdb.asia-southeast1.firebasedatabase.app';

    // APP STATE
    let users = [];
    let currentUser = null; // null = Khách (Guest)
    let posts = [];
    let notifications = [];
    let activeTagFilter = 'all';
    let currentSortMode = 'new';
    let searchQuery = '';
    let isCloudOnline = false;

    // Temporary upload buffers
    let pendingMediaDataUrl = null;
    let pendingMediaType = null;
    let pendingMediaName = '';
    let tempAvatarData = null;
    let tempCoverData = null;

    // LOCAL STORAGE HELPERS
    function safeGetStorage(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    }

    function safeSetStorage(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {}
    }

    // GET ACTIVE CLOUD DATABASE URL
    function getCloudUrl() {
      const custom = safeGetStorage(STORAGE_KEYS.CLOUD_URL, '');
      let base = (custom && custom.trim()) ? custom.trim() : DEFAULT_CLOUD_URL;
      // Strip trailing slashes
      base = base.replace(/\/+$/, '');
      return base;
    }

    // CLIENT-SIDE IMAGE COMPRESSION (CRITICAL FOR CROSS-DEVICE MOBILE SYNC)
    function compressImageFile(file, maxDimension = 1200, quality = 0.76) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = () => resolve(e.target.result);
          img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    }

    // CLOUD DATABASE API CLIENT
    async function fetchCloudData(endpoint) {
      const baseUrl = getCloudUrl();
      const url = `${baseUrl}${endpoint}.json`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    }

    async function putCloudData(endpoint, data) {
      const baseUrl = getCloudUrl();
      const url = `${baseUrl}${endpoint}.json`;
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    }

    async function deleteCloudData(endpoint) {
      const baseUrl = getCloudUrl();
      const url = `${baseUrl}${endpoint}.json`;
      const resp = await fetch(url, { method: 'DELETE' });
      return resp;
    }

    // SYNC FROM CLOUD & MERGE STATE
    async function syncFromCloud(showFeedback = false) {
      const syncDot = document.getElementById('syncDot');
      const syncText = document.getElementById('syncStatusText');
      const navDot = document.getElementById('navStatusDot');
      const navText = document.getElementById('navStatusText');

      try {
        const data = await fetchCloudData('/lop9a3');
        isCloudOnline = true;

        if (syncDot) syncDot.classList.add('online');
        if (navDot) navDot.classList.add('connected');
        if (navText) navText.textContent = 'Máy chủ: Đang kết nối';
        if (syncText) syncText.textContent = 'Đồng bộ trực tuyến — Mọi máy tính & điện thoại đều thấy bài';

        if (data && typeof data === 'object') {
          // 1. Merge Posts
          if (data.posts) {
            const remotePosts = Array.isArray(data.posts)
              ? data.posts.filter(Boolean)
              : Object.values(data.posts).filter(Boolean);

            const postMap = new Map();
            posts.forEach(p => postMap.set(p.id, p));
            remotePosts.forEach(rp => {
              const local = postMap.get(rp.id);
              if (!local) {
                postMap.set(rp.id, rp);
              } else {
                // Merge votes, ratings & comments
                postMap.set(rp.id, {
                  ...local,
                  ...rp,
                  mediaUrl: rp.mediaUrl || local.mediaUrl,
                  comments: rp.comments || local.comments || [],
                  ratings: rp.ratings || local.ratings || {},
                  upvotes: rp.upvotes || local.upvotes || [],
                  downvotes: rp.downvotes || local.downvotes || []
                });
              }
            });
            posts = Array.from(postMap.values()).sort((a, b) => b.createdAt - a.createdAt);
          }

          // 2. Merge Users
          if (data.users) {
            const remoteUsers = Array.isArray(data.users)
              ? data.users.filter(Boolean)
              : Object.values(data.users).filter(Boolean);

            const userMap = new Map();
            users.forEach(u => userMap.set(u.username.toLowerCase(), u));
            remoteUsers.forEach(ru => {
              if (ru && ru.username) {
                userMap.set(ru.username.toLowerCase(), ru);
              }
            });
            users = Array.from(userMap.values());
          }

          // 3. Merge Notifications
          if (data.notifications) {
            const remoteNotifs = Array.isArray(data.notifications)
              ? data.notifications.filter(Boolean)
              : Object.values(data.notifications).filter(Boolean);

            const notifMap = new Map();
            notifications.forEach(n => notifMap.set(n.id, n));
            remoteNotifs.forEach(rn => notifMap.set(rn.id, rn));
            notifications = Array.from(notifMap.values()).sort((a, b) => b.createdAt - a.createdAt);
          }

          persistAllLocal();
          renderTagNavigation();
          renderFeed();
          renderNotifications();
        }

        if (showFeedback) showToast('Đã cập nhật bài đăng mới nhất từ máy chủ đám mây!');
      } catch (err) {
        isCloudOnline = false;
        if (syncDot) syncDot.classList.remove('online');
        if (navDot) navDot.classList.remove('connected');
        if (navText) navText.textContent = 'Máy chủ: Ngoại tuyến';
        if (syncText) syncText.textContent = 'Chưa kết nối máy chủ — Đang lưu tạm trên thiết bị này (Bấm "Cài máy chủ")';
        if (showFeedback) showToast('Không thể kết nối máy chủ đám mây. Vui lòng kiểm tra lại URL Database!');
      }
    }

    // PUSH NEW OR UPDATED ENTITY TO CLOUD
    async function pushEntityToCloud(type, id, entityData) {
      persistAllLocal();
      try {
        if (type === 'post') {
          await putCloudData(`/lop9a3/posts/${id}`, entityData);
        } else if (type === 'user') {
          await putCloudData(`/lop9a3/users/${id}`, entityData);
        } else if (type === 'notif') {
          await putCloudData(`/lop9a3/notifications/${id}`, entityData);
        }
        isCloudOnline = true;
      } catch (e) {
        console.warn('Could not push to cloud database:', e);
      }
    }

    function persistAllLocal() {
      safeSetStorage(STORAGE_KEYS.USERS, users);
      safeSetStorage('9a3_users_backup', users);
      safeSetStorage(STORAGE_KEYS.SESSION, currentUser);
      safeSetStorage(STORAGE_KEYS.POSTS, posts);
      safeSetStorage(STORAGE_KEYS.NOTIFS, notifications);
    }

    // INITIALIZATION
    async function initApp() {
      const savedTheme = safeGetStorage(STORAGE_KEYS.THEME, 'light');
      applyTheme(savedTheme);

      // Bulletproof user loading with legacy key fallback
      let loadedUsers = safeGetStorage(STORAGE_KEYS.USERS, null);
      if (!loadedUsers || !Array.isArray(loadedUsers) || loadedUsers.length === 0) {
        loadedUsers = safeGetStorage('9a3_users_backup', null) ||
                      safeGetStorage('9a3_v2_users', null) ||
                      safeGetStorage('9a3_users', []);
      }
      users = Array.isArray(loadedUsers) ? loadedUsers : [];
      currentUser = safeGetStorage(STORAGE_KEYS.SESSION, null);
      posts = safeGetStorage(STORAGE_KEYS.POSTS, []);
      notifications = safeGetStorage(STORAGE_KEYS.NOTIFS, []);

      renderTagNavigation();
      populatePostTagSelect();
      renderUserUI();
      renderFeed();
      renderNotifications();

      // Show modal on first visit if not logged in
      if (!currentUser) {
        openAuthModal('register');
      }

      // Initial cloud sync and periodic polling every 6 seconds so other devices' posts appear
      syncFromCloud(false);
      setInterval(() => syncFromCloud(false), 6000);

      // Close dropdowns on outside click
      document.addEventListener('click', (e) => {
        const notifWrap = document.querySelector('.notif-wrapper');
        if (notifWrap && !notifWrap.contains(e.target)) {
          document.getElementById('notifDropdown').classList.remove('open');
        }
        const miniWrap = document.getElementById('miniFilterWrap');
        if (miniWrap && !miniWrap.contains(e.target)) {
          document.getElementById('miniFilterMenu').classList.remove('open');
        }
      });
    }

    // THEME TOGGLE
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      const btn = document.getElementById('themeToggleBtn');
      if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Chuyển sang Nền sáng' : 'Chuyển sang Nền tối';
      }
      safeSetStorage(STORAGE_KEYS.THEME, theme);
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      showToast(next === 'dark' ? 'Đã bật chế độ Nền tối' : 'Đã bật chế độ Nền sáng');
    }

    // NAVIGATION & TAG FILTERING
    function renderTagNavigation() {
      const sideList = document.getElementById('sidebarTagList');
      const drawerList = document.getElementById('drawerTagList');
      const miniMenu = document.getElementById('miniFilterMenu');

      const allCount = posts.length;
      let sideHtml = `
        <button class="side-nav-btn ${activeTagFilter === 'all' ? 'active' : ''}" onclick="selectTagFilter('all')">
          <span>📚 Tất cả môn học</span>
          <span style="font-size:0.75rem; opacity:0.8;">${allCount}</span>
        </button>
      `;

      let miniHtml = `
        <button class="filter-dropdown-item ${activeTagFilter === 'all' ? 'active' : ''}" onclick="selectTagFilter('all')">
          <span>📚 Tất cả môn học</span>
          <span>${allCount}</span>
        </button>
      `;

      SUBJECT_TAGS.forEach(tag => {
        const count = posts.filter(p => p.tagId === tag.id).length;
        const activeClass = activeTagFilter === tag.id ? 'active' : '';
        sideHtml += `
          <button class="side-nav-btn ${activeClass}" onclick="selectTagFilter('${tag.id}')">
            <span>${tag.icon} ${tag.name}</span>
            <span style="font-size:0.75rem; opacity:0.75;">${count}</span>
          </button>
        `;
        miniHtml += `
          <button class="filter-dropdown-item ${activeClass}" onclick="selectTagFilter('${tag.id}')">
            <span>${tag.icon} ${tag.name}</span>
            <span>${count}</span>
          </button>
        `;
      });

      if (sideList) sideList.innerHTML = sideHtml;
      if (drawerList) drawerList.innerHTML = sideHtml;
      if (miniMenu) miniMenu.innerHTML = miniHtml;

      const miniLabel = document.getElementById('miniFilterLabel');
      const activeFilterLabel = document.getElementById('activeFilterLabel');
      if (activeTagFilter === 'all') {
        if (miniLabel) miniLabel.textContent = 'Tất cả môn';
        if (activeFilterLabel) activeFilterLabel.textContent = 'Đang xem: Tất cả môn học';
      } else {
        const found = SUBJECT_TAGS.find(t => t.id === activeTagFilter);
        if (found) {
          if (miniLabel) miniLabel.textContent = `${found.icon} ${found.name}`;
          if (activeFilterLabel) activeFilterLabel.textContent = `Đang lọc môn: ${found.icon} ${found.name}`;
        }
      }
    }

    function populatePostTagSelect() {
      const select = document.getElementById('postTagSelect');
      if (!select) return;
      select.innerHTML = SUBJECT_TAGS.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('');
    }

    function selectTagFilter(tagId) {
      activeTagFilter = tagId;
      document.getElementById('miniFilterMenu').classList.remove('open');
      closeMobileDrawer();
      renderTagNavigation();
      renderFeed();
    }

    function toggleMiniFilterMenu(e) {
      e.stopPropagation();
      document.getElementById('miniFilterMenu').classList.toggle('open');
    }

    function resetToMainPage() {
      activeTagFilter = 'all';
      currentSortMode = 'new';
      searchQuery = '';
      const sInput = document.getElementById('searchInput');
      if (sInput) sInput.value = '';
      document.getElementById('clearSearchBtn').style.display = 'none';
      updateSortTabsUI();
      renderTagNavigation();
      renderFeed();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setSortMode(mode) {
      currentSortMode = mode;
      updateSortTabsUI();
      renderFeed();
    }

    function updateSortTabsUI() {
      document.getElementById('sortNew').classList.toggle('active', currentSortMode === 'new');
      document.getElementById('sortTop').classList.toggle('active', currentSortMode === 'top');
    }

    function handleSearchInput() {
      const val = document.getElementById('searchInput').value.trim();
      searchQuery = val;
      document.getElementById('clearSearchBtn').style.display = val ? 'block' : 'none';
      renderFeed();
    }

    function clearSearch() {
      document.getElementById('searchInput').value = '';
      searchQuery = '';
      document.getElementById('clearSearchBtn').style.display = 'none';
      renderFeed();
    }

    // MOBILE DRAWER
    function toggleMobileDrawer() {
      document.getElementById('mobileDrawer').classList.toggle('open');
      document.getElementById('drawerBackdrop').classList.toggle('open');
    }

    function closeMobileDrawer() {
      document.getElementById('mobileDrawer').classList.remove('open');
      document.getElementById('drawerBackdrop').classList.remove('open');
    }

    // USER AUTHENTICATION
    function renderUserUI() {
      const navUserArea = document.getElementById('navUserArea');
      const quickBarAvatar = document.getElementById('quickBarAvatar');
      const sideAvatar = document.getElementById('sideProfileAvatar');
      const sideCover = document.getElementById('sideProfileCover');
      const sideDisplay = document.getElementById('sideProfileDisplayName');
      const sideUser = document.getElementById('sideProfileUsername');
      const sideBio = document.getElementById('sideProfileBio');
      const sidePrimaryBtn = document.getElementById('sideAccountPrimaryBtn');
      const sideLogoutBtn = document.getElementById('sideLogoutBtn');
      const drawerStatus = document.getElementById('drawerUserStatus');
      const drawerAccountBtn = document.getElementById('drawerAccountBtn');
      const drawerLogoutBtn = document.getElementById('drawerLogoutBtn');

      if (!currentUser) {
        if (navUserArea) {
          navUserArea.innerHTML = `
            <div class="user-pill" onclick="openAuthModal('login')" title="Khách — Nhấn để Đăng nhập hoặc Đăng ký">
              <div class="avatar-sm" style="background:#64748B;">K</div>
              <div class="user-pill-info">
                <span class="user-pill-name">Khách</span>
                <span class="user-pill-handle">Đăng nhập</span>
              </div>
            </div>
          `;
        }
        if (quickBarAvatar) quickBarAvatar.innerHTML = 'K';
        if (sideAvatar) sideAvatar.innerHTML = 'K';
        if (sideCover) sideCover.style.background = COVER_PRESETS.orange;
        if (sideDisplay) sideDisplay.textContent = 'Khách';
        if (sideUser) sideUser.textContent = 'Chưa đăng nhập';
        if (sideBio) sideBio.textContent = 'Bạn đang xem với tư cách Khách. Hãy đăng ký hoặc đăng nhập để đăng bài, bình luận và chấm sao.';
        if (sidePrimaryBtn) sidePrimaryBtn.innerHTML = '🔑 Đăng nhập / Đăng ký';
        if (sideLogoutBtn) sideLogoutBtn.style.display = 'none';
        if (drawerStatus) drawerStatus.textContent = 'Đang là Khách (Chưa đăng nhập)';
        if (drawerAccountBtn) drawerAccountBtn.innerHTML = '🔑 Đăng nhập / Đăng ký';
        if (drawerLogoutBtn) drawerLogoutBtn.style.display = 'none';
      } else {
        const initial = (currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase();
        const avatarHtml = currentUser.avatar
          ? `<img src="${currentUser.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;" />`
          : initial;

        if (navUserArea) {
          navUserArea.innerHTML = `
            <div class="user-pill" onclick="openProfileModal()" title="Chỉnh sửa tài khoản">
              <div class="avatar-sm">${avatarHtml}</div>
              <div class="user-pill-info">
                <span class="user-pill-name">${escapeHtml(currentUser.displayName)}</span>
                <span class="user-pill-handle">Chỉnh sửa tài khoản</span>
              </div>
            </div>
          `;
        }
        if (quickBarAvatar) quickBarAvatar.innerHTML = avatarHtml;
        if (sideAvatar) sideAvatar.innerHTML = avatarHtml;
        if (sideCover) {
          if (currentUser.cover && currentUser.cover.startsWith('data:image')) {
            sideCover.style.backgroundImage = `url(${currentUser.cover})`;
          } else {
            sideCover.style.background = currentUser.cover || COVER_PRESETS.orange;
          }
        }
        if (sideDisplay) sideDisplay.textContent = currentUser.displayName;
        if (sideUser) sideUser.textContent = `@${currentUser.username}`;
        if (sideBio) sideBio.textContent = currentUser.bio || 'Thành viên Lớp 9A3 An Châu';
        if (sidePrimaryBtn) sidePrimaryBtn.innerHTML = '⚙️ Chỉnh sửa tài khoản';
        if (sideLogoutBtn) sideLogoutBtn.style.display = 'inline-flex';
        if (drawerStatus) drawerStatus.textContent = `${currentUser.displayName} (@${currentUser.username})`;
        if (drawerAccountBtn) drawerAccountBtn.innerHTML = '⚙️ Chỉnh sửa tài khoản';
        if (drawerLogoutBtn) drawerLogoutBtn.style.display = 'inline-flex';
      }
    }

    function handleAccountAction() {
      if (!currentUser) {
        openAuthModal('login');
      } else {
        openProfileModal();
      }
    }

    function openAuthModal(defaultTab = 'register', noticeMessage = '') {
      document.getElementById('authModal').classList.add('open');
      switchAuthTab(defaultTab, noticeMessage);
    }

    function closeAuthModal() {
      document.getElementById('authModal').classList.remove('open');
    }

    function switchAuthTab(tab, noticeMessage = '') {
      const regBtn = document.getElementById('tabRegisterBtn');
      const loginBtn = document.getElementById('tabLoginBtn');
      const regBox = document.getElementById('registerFormBox');
      const loginBox = document.getElementById('loginFormBox');
      const banner = document.getElementById('authNoticeBanner');

      if (noticeMessage) {
        banner.textContent = noticeMessage;
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }

      if (tab === 'register') {
        regBtn.classList.add('active');
        loginBtn.classList.remove('active');
        regBox.style.display = 'flex';
        loginBox.style.display = 'none';
      } else {
        regBtn.classList.remove('active');
        loginBtn.classList.add('active');
        regBox.style.display = 'none';
        loginBox.style.display = 'flex';
        renderRememberedAccounts();
      }
    }

    async function handleRegisterSubmit() {
      const usernameRaw = document.getElementById('regUsername').value.trim();
      const displayName = document.getElementById('regDisplayName').value.trim();
      const password = document.getElementById('regPassword').value.trim();

      if (!usernameRaw || !displayName || !password) {
        showToast('Vui lòng nhập đầy đủ Tên đăng nhập, Tên hiển thị và Mật khẩu!');
        return;
      }

      const cleanUsername = usernameRaw.replace(/\s+/g, '');
      const cleanKey = cleanUsername.toLowerCase();
      const exists = users.some(u => u.username.toLowerCase() === cleanKey);
      if (exists) {
        showToast('Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác!');
        return;
      }

      const newUser = {
        username: cleanUsername,
        displayName: displayName,
        password: password,
        bio: 'Thành viên Lớp 9A3 An Châu',
        avatar: '',
        cover: COVER_PRESETS.orange,
        createdAt: Date.now()
      };

      users.push(newUser);
      persistAllLocal();
      await pushEntityToCloud('user', cleanKey, newUser);

      document.getElementById('regUsername').value = '';
      document.getElementById('regDisplayName').value = '';
      document.getElementById('regPassword').value = '';
      document.getElementById('loginUsername').value = cleanUsername;
      document.getElementById('loginPassword').value = '';

      switchAuthTab('login', '✅ Đăng ký thành công! Hãy nhập mật khẩu để đăng nhập.');
      showToast('Đăng ký thành công! Hãy đăng nhập vào tài khoản của bạn.');
    }

    async function handleLoginSubmit() {
      const usernameInput = document.getElementById('loginUsername').value.trim();
      const passwordInput = document.getElementById('loginPassword').value.trim();

      if (!usernameInput || !passwordInput) {
        showToast('Vui lòng nhập Tên đăng nhập và Mật khẩu!');
        return;
      }

      const cleanKey = usernameInput.replace(/\s+/g, '').toLowerCase();

      // 1. Check in local memory/cache first
      let matched = users.find(
        u => u.username.toLowerCase() === cleanKey && u.password.trim() === passwordInput
      );

      // 2. If not found locally (e.g. account created on PC and now logging in on phone), check Cloud Database
      if (!matched) {
        try {
          const remoteUser = await fetchCloudData(`/lop9a3/users/${cleanKey}`);
          if (remoteUser && remoteUser.username && remoteUser.password.trim() === passwordInput) {
            matched = remoteUser;
            // Cache account locally on this device so next reload it is available
            const exists = users.some(u => u.username.toLowerCase() === cleanKey);
            if (!exists) {
              users.push(remoteUser);
            } else {
              users = users.map(u => u.username.toLowerCase() === cleanKey ? remoteUser : u);
            }
            persistAllLocal();
          }
        } catch (e) {
          console.warn('Cloud login check:', e);
        }
      }

      if (!matched) {
        showToast('Sai tên đăng nhập hoặc mật khẩu! Vui lòng kiểm tra lại.');
        return;
      }

      currentUser = { ...matched };
      persistAllLocal();
      renderUserUI();
      renderFeed();
      renderNotifications();
      closeAuthModal();
      showToast(`Chào mừng ${currentUser.displayName} đã đăng nhập!`);
    }

    function logoutUser() {
      currentUser = null;
      persistAllLocal();
      closeProfileModal();
      renderUserUI();
      renderFeed();
      renderNotifications();
      showToast('Đã đăng xuất! Bạn đang ở chế độ Khách.');
    }

    function renderRememberedAccounts() {
      const box = document.getElementById('rememberedAccountsBox');
      const list = document.getElementById('rememberedAccountsList');
      if (!box || !list) return;
      if (!users || users.length === 0) {
        box.style.display = 'none';
        return;
      }
      box.style.display = 'flex';
      list.innerHTML = users.slice(0, 5).map(u => `
        <button type="button" class="btn-secondary" style="height:26px; padding:0 8px; font-size:0.75rem;" onclick="selectRememberedUser('${escapeHtml(u.username)}')">
          👤 ${escapeHtml(u.displayName)} (@${escapeHtml(u.username)})
        </button>
      `).join('');
    }

    function selectRememberedUser(username) {
      const input = document.getElementById('loginUsername');
      if (input) {
        input.value = username;
        document.getElementById('loginPassword').focus();
      }
    }

    // PROFILE MODAL
    function openProfileModal() {
      if (!currentUser) {
        openAuthModal('login');
        return;
      }
      tempAvatarData = currentUser.avatar || '';
      tempCoverData = currentUser.cover || COVER_PRESETS.orange;

      document.getElementById('editDisplayNameInput').value = currentUser.displayName || '';
      document.getElementById('editUsernameInput').value = currentUser.username || '';
      document.getElementById('editBioInput').value = currentUser.bio || '';

      updateEditProfilePreviews();
      document.getElementById('profileModal').classList.add('open');
    }

    function closeProfileModal() {
      document.getElementById('profileModal').classList.remove('open');
    }

    function updateEditProfilePreviews() {
      const avPreview = document.getElementById('editAvatarPreview');
      const covPreview = document.getElementById('editCoverPreview');
      const initial = (currentUser ? currentUser.displayName : 'K').charAt(0).toUpperCase();

      if (tempAvatarData) {
        avPreview.innerHTML = `<img src="${tempAvatarData}" alt="avatar" style="width:100%;height:100%;object-fit:cover;" />`;
      } else {
        avPreview.innerHTML = initial;
      }

      if (tempCoverData && tempCoverData.startsWith('data:image')) {
        covPreview.style.backgroundImage = `url(${tempCoverData})`;
      } else {
        covPreview.style.background = tempCoverData || COVER_PRESETS.orange;
      }
    }

    async function handleAvatarFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      showToast('Đang nén ảnh đại diện...');
      tempAvatarData = await compressImageFile(file, 400, 0.8);
      updateEditProfilePreviews();
    }

    async function handleCoverFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      showToast('Đang nén ảnh bìa...');
      tempCoverData = await compressImageFile(file, 900, 0.75);
      updateEditProfilePreviews();
    }

    function selectPresetCover(presetKey) {
      tempCoverData = COVER_PRESETS[presetKey] || COVER_PRESETS.orange;
      updateEditProfilePreviews();
    }

    async function saveProfileChanges() {
      if (!currentUser) return;
      const newDisplay = document.getElementById('editDisplayNameInput').value.trim();
      const newUsername = document.getElementById('editUsernameInput').value.trim().replace(/\s+/g, '');
      const newBio = document.getElementById('editBioInput').value.trim();

      if (!newDisplay || !newUsername) {
        showToast('Tên hiển thị và Tên đăng nhập không được để trống!');
        return;
      }

      const conflict = users.some(
        u => u.username.toLowerCase() === newUsername.toLowerCase() &&
             u.username.toLowerCase() !== currentUser.username.toLowerCase()
      );
      if (conflict) {
        showToast('Tên đăng nhập này đã có người sử dụng!');
        return;
      }

      const oldUsername = currentUser.username;
      currentUser.displayName = newDisplay;
      currentUser.username = newUsername;
      currentUser.bio = newBio;
      currentUser.avatar = tempAvatarData;
      currentUser.cover = tempCoverData;

      users = users.map(u => (u.username.toLowerCase() === oldUsername.toLowerCase() ? { ...currentUser } : u));

      posts.forEach(p => {
        if (p.authorUsername && p.authorUsername.toLowerCase() === oldUsername.toLowerCase()) {
          p.authorUsername = newUsername;
          p.authorName = newDisplay;
          p.authorAvatar = tempAvatarData;
        }
      });

      await pushEntityToCloud('user', newUsername.toLowerCase(), currentUser);
      renderUserUI();
      renderFeed();
      closeProfileModal();
      showToast('Đã lưu thông tin tài khoản lên máy chủ!');
    }

    // CREATE POST & MEDIA UPLOAD
    function openCreatePostModal() {
      if (!currentUser) {
        showToast('Vui lòng đăng nhập hoặc đăng ký tài khoản để đăng bài!');
        openAuthModal('login');
        return;
      }
      document.getElementById('createPostModal').classList.add('open');
    }

    function closeCreatePostModal() {
      document.getElementById('createPostModal').classList.remove('open');
    }

    async function handlePostMediaSelect(e) {
      const file = e.target.files[0];
      if (!file) return;

      const maxBytes = 100 * 1024 * 1024; // 100MB
      if (file.size > maxBytes) {
        showToast('Tệp vượt quá giới hạn 100MB! Vui lòng chọn tệp nhỏ hơn.');
        e.target.value = '';
        return;
      }

      const previewBox = document.getElementById('mediaPreviewBox');
      const previewContent = document.getElementById('mediaPreviewContent');
      previewBox.style.display = 'block';

      if (file.type.startsWith('video/')) {
        pendingMediaType = 'video';
        pendingMediaName = file.name;
        showToast('Đang tải video...');
        const reader = new FileReader();
        reader.onload = (ev) => {
          pendingMediaDataUrl = ev.target.result;
          previewContent.innerHTML = `<video src="${pendingMediaDataUrl}" controls style="max-height:220px; border-radius:8px; max-width:100%;"></video>`;
        };
        reader.readAsDataURL(file);
      } else {
        pendingMediaType = 'image';
        pendingMediaName = file.name;
        showToast('Đang tối ưu hình ảnh...');
        pendingMediaDataUrl = await compressImageFile(file, 1280, 0.78);
        previewContent.innerHTML = `<img src="${pendingMediaDataUrl}" alt="preview" style="max-height:220px; border-radius:8px; max-width:100%;" />`;
      }
    }

    function clearSelectedMedia() {
      pendingMediaDataUrl = null;
      pendingMediaType = null;
      pendingMediaName = '';
      document.getElementById('postMediaInput').value = '';
      document.getElementById('mediaPreviewBox').style.display = 'none';
      document.getElementById('mediaPreviewContent').innerHTML = '';
    }

    async function submitNewPost() {
      if (!currentUser) {
        openAuthModal('login');
        return;
      }

      const tagId = document.getElementById('postTagSelect').value;
      const title = document.getElementById('postTitleInput').value.trim();
      const body = document.getElementById('postBodyInput').value.trim();

      if (!title) {
        showToast('Vui lòng nhập tiêu đề bài đăng!');
        return;
      }

      const submitBtn = document.getElementById('submitPostBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Đang đăng...';

      const newPost = {
        id: 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        tagId: tagId,
        title: title,
        body: body,
        authorName: currentUser.displayName,
        authorUsername: currentUser.username,
        authorAvatar: currentUser.avatar || '',
        createdAt: Date.now(),
        mediaUrl: pendingMediaDataUrl,
        mediaType: pendingMediaType,
        upvotes: [],
        downvotes: [],
        ratings: {},
        comments: []
      };

      posts.unshift(newPost);
      await pushEntityToCloud('post', newPost.id, newPost);

      document.getElementById('postTitleInput').value = '';
      document.getElementById('postBodyInput').value = '';
      clearSelectedMedia();
      closeCreatePostModal();

      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Đăng bài ngay';

      renderTagNavigation();
      renderFeed();
      showToast('Đã đăng bài viết! Các máy khác sẽ nhìn thấy ngay.');
    }

    // VOTING, 0-5 STAR RATING, COMMENTS & NOTIFICATIONS
    async function handleVote(postId, direction) {
      if (!currentUser) {
        showToast('Hãy đăng nhập để bầu chọn bài viết!');
        openAuthModal('login');
        return;
      }

      const post = posts.find(p => p.id === postId);
      if (!post) return;
      post.upvotes = post.upvotes || [];
      post.downvotes = post.downvotes || [];

      const uname = currentUser.username;
      const upIdx = post.upvotes.indexOf(uname);
      const downIdx = post.downvotes.indexOf(uname);

      if (direction === 'up') {
        if (upIdx !== -1) {
          post.upvotes.splice(upIdx, 1);
        } else {
          post.upvotes.push(uname);
          if (downIdx !== -1) post.downvotes.splice(downIdx, 1);
          createNotification(post.authorUsername, 'upvote', `${currentUser.displayName} đã bầu chọn tăng cho bài viết "${post.title}"`, post.id);
        }
      } else {
        if (downIdx !== -1) {
          post.downvotes.splice(downIdx, 1);
        } else {
          post.downvotes.push(uname);
          if (upIdx !== -1) post.upvotes.splice(upIdx, 1);
          createNotification(post.authorUsername, 'downvote', `${currentUser.displayName} đã bầu chọn giảm cho bài viết "${post.title}"`, post.id);
        }
      }

      renderFeed();
      await pushEntityToCloud('post', post.id, post);
    }

    async function handleRatePost(postId, starValue) {
      if (!currentUser) {
        showToast('Hãy đăng nhập để chấm điểm sao cho bài viết!');
        openAuthModal('login');
        return;
      }

      const post = posts.find(p => p.id === postId);
      if (!post) return;
      post.ratings = post.ratings || {};
      post.ratings[currentUser.username] = starValue;

      createNotification(
        post.authorUsername,
        'rating',
        `${currentUser.displayName} đã đánh giá ${starValue}/5 ⭐ cho bài viết "${post.title}"`,
        post.id
      );

      renderFeed();
      showToast(`Đã chấm ${starValue}/5 sao!`);
      await pushEntityToCloud('post', post.id, post);
    }

    function toggleComments(postId) {
      const box = document.getElementById('comments_' + postId);
      if (box) box.classList.toggle('open');
    }

    async function submitComment(postId) {
      if (!currentUser) {
        showToast('Hãy đăng nhập để bình luận!');
        openAuthModal('login');
        return;
      }

      const input = document.getElementById('commentInput_' + postId);
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;

      const post = posts.find(p => p.id === postId);
      if (!post) return;
      post.comments = post.comments || [];

      post.comments.push({
        id: 'cmt_' + Date.now(),
        authorName: currentUser.displayName,
        authorUsername: currentUser.username,
        text: text,
        createdAt: Date.now()
      });

      createNotification(
        post.authorUsername,
        'comment',
        `${currentUser.displayName} đã bình luận vào bài "${post.title}": "${text}"`,
        post.id
      );

      input.value = '';
      renderFeed();
      const box = document.getElementById('comments_' + postId);
      if (box) box.classList.add('open');
      await pushEntityToCloud('post', post.id, post);
    }

    async function deletePost(postId) {
      const idx = posts.findIndex(p => p.id === postId);
      if (idx === -1) return;
      posts.splice(idx, 1);
      renderTagNavigation();
      renderFeed();
      showToast('Đã xoá bài đăng.');
      persistAllLocal();
      try {
        await deleteCloudData(`/lop9a3/posts/${postId}`);
      } catch (e) {}
    }

    // NOTIFICATIONS SYSTEM
    function createNotification(targetUsername, type, message, postId) {
      const notif = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        targetUsername: targetUsername || '',
        type: type,
        message: message,
        postId: postId,
        read: false,
        createdAt: Date.now()
      };
      notifications.unshift(notif);
      renderNotifications();
      pushEntityToCloud('notif', notif.id, notif);
    }

    function toggleNotifDropdown(e) {
      e.stopPropagation();
      document.getElementById('notifDropdown').classList.toggle('open');
    }

    function markAllNotifsRead() {
      notifications.forEach(n => { n.read = true; });
      persistAllLocal();
      renderNotifications();
    }

    function renderNotifications() {
      const listEl = document.getElementById('notifList');
      const badgeEl = document.getElementById('notifBadge');
      if (!listEl || !badgeEl) return;

      const visibleNotifs = currentUser
        ? notifications.filter(n => !n.targetUsername || n.targetUsername.toLowerCase() === currentUser.username.toLowerCase())
        : [];

      const unreadCount = visibleNotifs.filter(n => !n.read).length;
      if (unreadCount > 0) {
        badgeEl.style.display = 'flex';
        badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
      } else {
        badgeEl.style.display = 'none';
      }

      if (visibleNotifs.length === 0) {
        listEl.innerHTML = `
          <div style="padding:28px 16px; text-align:center; color:var(--text-muted); font-size:0.84rem;">
            Chưa có thông báo tương tác nào.
          </div>
        `;
        return;
      }

      listEl.innerHTML = visibleNotifs.map(n => {
        const icon = n.type === 'rating' ? '⭐' : n.type === 'comment' ? '💬' : n.type === 'upvote' ? '⬆️' : '⬇️';
        return `
          <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}', '${n.postId || ''}')">
            <div class="notif-icon">${icon}</div>
            <div class="notif-body">
              <div>${escapeHtml(n.message)}</div>
              <div class="notif-time">${formatTimeAgo(n.createdAt)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    function handleNotifClick(notifId, postId) {
      const found = notifications.find(n => n.id === notifId);
      if (found) found.read = true;
      persistAllLocal();
      renderNotifications();
      document.getElementById('notifDropdown').classList.remove('open');
      if (postId) {
        const postEl = document.getElementById('postCard_' + postId);
        if (postEl) postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // CLOUD SETTINGS MODAL
    function openCloudModal() {
      const input = document.getElementById('cloudDbUrlInput');
      const currentUrl = safeGetStorage(STORAGE_KEYS.CLOUD_URL, '') || DEFAULT_CLOUD_URL;
      if (input) input.value = currentUrl;
      const statusBox = document.getElementById('cloudTestStatusBox');
      if (statusBox) statusBox.style.display = 'none';
      document.getElementById('cloudModal').classList.add('open');
    }

    function closeCloudModal() {
      document.getElementById('cloudModal').classList.remove('open');
    }

    function resetDefaultCloudUrl() {
      const input = document.getElementById('cloudDbUrlInput');
      if (input) input.value = DEFAULT_CLOUD_URL;
      safeSetStorage(STORAGE_KEYS.CLOUD_URL, DEFAULT_CLOUD_URL);
      showToast('Đã khôi phục đường dẫn máy chủ mặc định!');
    }

    async function saveAndTestCloudConnection() {
      const input = document.getElementById('cloudDbUrlInput');
      const val = input.value.trim().replace(/\/+$/, '');
      safeSetStorage(STORAGE_KEYS.CLOUD_URL, val);
      await testCurrentCloudConnection();
    }

    async function testCurrentCloudConnection() {
      const statusBox = document.getElementById('cloudTestStatusBox');
      if (!statusBox) return;
      statusBox.style.display = 'block';
      statusBox.style.background = 'var(--bg-elevated)';
      statusBox.style.color = 'var(--text-primary)';
      statusBox.textContent = '⏳ Đang kiểm tra kết nối tới máy chủ đám mây...';

      try {
        const testPing = await putCloudData('/lop9a3/ping', { timestamp: Date.now(), client: 'check' });
        const readPing = await fetchCloudData('/lop9a3/ping');
        if (readPing && readPing.timestamp) {
          statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
          statusBox.style.color = 'var(--success)';
          statusBox.innerHTML = '✅ Kết nối máy chủ thành công 100%! Dữ liệu đã đồng bộ xuyên suốt giữa máy tính và điện thoại.';
          showToast('Kết nối máy chủ thành công!');
          syncFromCloud(false);
        } else {
          throw new Error('Dữ liệu phản hồi không khớp');
        }
      } catch (err) {
        statusBox.style.background = 'rgba(239, 68, 68, 0.12)';
        statusBox.style.color = 'var(--danger)';
        statusBox.innerHTML = `⚠️ Không thể ghi dữ liệu: ${err.message}. Hãy đảm bảo bạn đã chọn chế độ "Bắt đầu ở chế độ thử nghiệm" (Test mode: read/write true) trên Firebase.`;
      }
    }

    // RENDER FEED
    function renderFeed() {
      const container = document.getElementById('postsFeedContainer');
      if (!container) return;

      let filtered = posts.filter(p => {
        if (activeTagFilter !== 'all' && p.tagId !== activeTagFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const tagObj = SUBJECT_TAGS.find(t => t.id === p.tagId);
          const tagName = tagObj ? tagObj.name.toLowerCase() : '';
          const matchTitle = (p.title || '').toLowerCase().includes(q);
          const matchBody = (p.body || '').toLowerCase().includes(q);
          const matchAuthor = (p.authorName || '').toLowerCase().includes(q);
          const matchTag = tagName.includes(q);
          return matchTitle || matchBody || matchAuthor || matchTag;
        }
        return true;
      });

      if (currentSortMode === 'new') {
        filtered.sort((a, b) => b.createdAt - a.createdAt);
      } else if (currentSortMode === 'top') {
        filtered.sort((a, b) => {
          const scoreA = (a.upvotes ? a.upvotes.length : 0) - (a.downvotes ? a.downvotes.length : 0);
          const scoreB = (b.upvotes ? b.upvotes.length : 0) - (b.downvotes ? b.downvotes.length : 0);
          return scoreB - scoreA;
        });
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-size:2.4rem; margin-bottom:8px;">📭</div>
            <div style="font-weight:800; font-size:1.05rem; margin-bottom:4px;">Chưa có bài đăng nào</div>
            <p style="font-size:0.86rem; color:var(--text-muted); margin-bottom:16px;">
              Hãy là người đầu tiên đăng bài viết, hình ảnh hoặc video lên cộng đồng Lớp 9A3!
            </p>
            <button class="btn-primary" onclick="openCreatePostModal()">＋ Đăng bài đầu tiên</button>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(post => {
        const tag = SUBJECT_TAGS.find(t => t.id === post.tagId) || SUBJECT_TAGS[0];
        const upCount = post.upvotes ? post.upvotes.length : 0;
        const downCount = post.downvotes ? post.downvotes.length : 0;
        const score = upCount - downCount;
        const isUpvoted = currentUser && post.upvotes && post.upvotes.includes(currentUser.username);
        const isDownvoted = currentUser && post.downvotes && post.downvotes.includes(currentUser.username);

        const ratingsObj = post.ratings || {};
        const ratingValues = Object.values(ratingsObj);
        const ratingCount = ratingValues.length;
        const avgRating = ratingCount > 0
          ? (ratingValues.reduce((s, v) => s + Number(v), 0) / ratingCount).toFixed(1)
          : '0.0';
        const myRating = currentUser && ratingsObj[currentUser.username] !== undefined
          ? ratingsObj[currentUser.username]
          : null;

        const initial = (post.authorName || '9').charAt(0).toUpperCase();
        const authorAvatarHtml = post.authorAvatar
          ? `<img src="${post.authorAvatar}" alt="avatar" />`
          : initial;

        let mediaHtml = '';
        if (post.mediaUrl) {
          if (post.mediaType === 'video') {
            mediaHtml = `<div class="post-media-container"><video src="${post.mediaUrl}" controls preload="metadata"></video></div>`;
          } else {
            mediaHtml = `<div class="post-media-container"><img src="${post.mediaUrl}" alt="Hình đính kèm" loading="lazy" /></div>`;
          }
        }

        const canDelete = currentUser && post.authorUsername &&
          currentUser.username.toLowerCase() === post.authorUsername.toLowerCase();

        const starsHtml = [1, 2, 3, 4, 5].map(num => {
          const filled = myRating !== null ? num <= myRating : num <= Math.round(Number(avgRating));
          return `<button class="star-btn ${filled ? 'filled' : ''}" onclick="handleRatePost('${post.id}', ${num})" title="Chấm ${num} sao">★</button>`;
        }).join('');

        const commentsList = post.comments || [];

        return `
          <article class="post-card" id="postCard_${post.id}">
            <div class="vote-column">
              <button class="vote-btn ${isUpvoted ? 'upvoted' : ''}" onclick="handleVote('${post.id}', 'up')" title="Bầu chọn tăng">▲</button>
              <span class="vote-score">${score}</span>
              <button class="vote-btn ${isDownvoted ? 'downvoted' : ''}" onclick="handleVote('${post.id}', 'down')" title="Bầu chọn giảm">▼</button>
            </div>

            <div class="post-main">
              <div class="post-meta">
                <span class="subject-tag" style="background:${tag.bg}; color:${tag.color};" onclick="selectTagFilter('${tag.id}')">
                  ${tag.icon} ${tag.name}
                </span>
                <span class="post-author">
                  <span class="author-avatar-xs">${authorAvatarHtml}</span>
                  <span>${escapeHtml(post.authorName)}</span>
                </span>
                <span>• ${formatTimeAgo(post.createdAt)}</span>
                ${canDelete ? `<button onclick="deletePost('${post.id}')" style="margin-left:auto; color:var(--danger); font-size:0.76rem; font-weight:700;">🗑️ Xoá</button>` : ''}
              </div>

              <h3 class="post-title">${escapeHtml(post.title)}</h3>
              ${post.body ? `<div class="post-body">${escapeHtml(post.body)}</div>` : ''}
              ${mediaHtml}

              <div class="post-footer">
                <div class="footer-actions">
                  <button class="action-chip" onclick="toggleComments('${post.id}')">
                    💬 ${commentsList.length} Bình luận
                  </button>
                </div>

                <div class="star-rating-box">
                  <button class="zero-star-btn ${myRating === 0 ? 'active' : ''}" onclick="handleRatePost('${post.id}', 0)" title="Đánh giá 0 sao">0★</button>
                  ${starsHtml}
                  <span class="star-avg-label">${avgRating}/5 (${ratingCount})</span>
                </div>
              </div>

              <!-- COMMENTS AREA -->
              <div class="comments-section" id="comments_${post.id}">
                <div class="comment-form">
                  <input
                    type="text"
                    id="commentInput_${post.id}"
                    class="comment-input"
                    placeholder="Viết bình luận của bạn..."
                    onkeydown="if(event.key==='Enter') submitComment('${post.id}')"
                  />
                  <button class="btn-primary" style="height:36px;" onclick="submitComment('${post.id}')">Gửi</button>
                </div>
                <div class="comment-list">
                  ${commentsList.length === 0
                    ? `<div style="font-size:0.8rem; color:var(--text-muted);">Chưa có bình luận nào.</div>`
                    : commentsList.map(c => `
                        <div class="comment-item">
                          <div class="comment-item-header">
                            <span class="comment-author">${escapeHtml(c.authorName)}</span>
                            <span>${formatTimeAgo(c.createdAt)}</span>
                          </div>
                          <div>${escapeHtml(c.text)}</div>
                        </div>
                      `).join('')
                  }
                </div>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    // UTILITIES
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatTimeAgo(ts) {
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 60) return 'Vừa xong';
      if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
      return `${Math.floor(diff / 86400)} ngày trước`;
    }

    function showToast(msg) {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      container.appendChild(t);
      setTimeout(() => {
        t.remove();
      }, 3200);
    }

    window.addEventListener('DOMContentLoaded', initApp);