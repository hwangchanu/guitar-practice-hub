import { NavLink } from 'react-router-dom';
import { useState, useCallback } from 'react';
import './Navigation.css';

const NAV_ITEMS = [
  { to: '/separation', label: '소스 분리' },
  { to: '/analysis', label: '연주 분석' },
  { to: '/tab', label: '타브 생성' },
  { to: '/chromatic', label: '크로매틱 연습' },
] as const;

export function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <nav aria-label="메인 내비게이션" className="nav">
      <div className="nav-container">
        <NavLink to="/" className="nav-brand" onClick={closeMenu}>
          🎸 Guitar Practice Hub
        </NavLink>

        <button
          type="button"
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          className="nav-hamburger"
        >
          <span />
          <span />
          <span />
        </button>

        <ul className={`nav-links${menuOpen ? ' open' : ''}`}>
          {NAV_ITEMS.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
