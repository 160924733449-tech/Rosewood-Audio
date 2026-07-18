import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ContextMenuContext = createContext(null);

export function useContextMenu() {
  return useContext(ContextMenuContext);
}

export function ContextMenuProvider({ children }) {
  const [menuConfig, setMenuConfig] = useState({
    visible: false,
    x: 0,
    y: 0,
    items: [],
    track: null
  });

  const openMenu = useCallback((e, items, track) => {
    e.preventDefault();
    setMenuConfig({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      items,
      track
    });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuConfig(prev => ({ ...prev, visible: false }));
  }, []);

  // Close menu on click anywhere
  useEffect(() => {
    if (menuConfig.visible) {
      document.addEventListener('click', closeMenu);
      // Close on scroll to prevent floating menu
      document.addEventListener('scroll', closeMenu, true);
      return () => {
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('scroll', closeMenu, true);
      };
    }
  }, [menuConfig.visible, closeMenu]);

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}
      {menuConfig.visible && (
        <div 
          className="context-menu"
          style={{ 
            left: `${menuConfig.x}px`, 
            top: `${menuConfig.y}px` 
          }}
          onClick={(e) => e.stopPropagation()} // prevent immediate close if clicked inside
        >
          {menuConfig.items.map((item, index) => (
            <button 
              key={index} 
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                item.action(menuConfig.track);
                closeMenu();
              }}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}
