export default function Topbar({ user, onMobileMenu, onLogout }) {
  const initials = (user?.name || user?.email || "OP")
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu" onClick={onMobileMenu} aria-label="Open navigation">
          <i className="bi bi-list" />
        </button>
        <div className="machine-context">
          <span className="online-dot" />
          <span>RFM760</span>
          <span>•</span>
          <span>Machine online</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="user-pill">
          <div className="user-pill-avatar">{initials}</div>
          <div className="user-pill-name">{user?.name || user?.email || "Operator"}</div>
        </div>
        <button className="btn btn-sm btn-light border" onClick={onLogout} title="Sign out">
          <i className="bi bi-box-arrow-right" />
        </button>
      </div>
    </header>
  );
}
