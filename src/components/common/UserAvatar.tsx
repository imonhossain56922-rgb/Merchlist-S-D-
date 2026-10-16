import React, { useState } from 'react';
import { UserRole } from '../../types';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  role?: UserRole;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showRoleDot?: boolean;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-base font-bold',
  '2xl': 'w-20 h-20 text-2xl font-bold',
};

const roleColors: Record<UserRole, string> = {
  ADMIN: 'bg-purple-950 text-purple-200 border-purple-500/40',
  HEAD_OF_SALES: 'bg-indigo-950 text-indigo-200 border-indigo-500/40',
  SALES_REPRESENTATIVE: 'bg-cyan-950 text-cyan-200 border-cyan-500/40',
  DESIGNER: 'bg-emerald-950 text-emerald-200 border-emerald-500/40',
};

const roleDotColors: Record<UserRole, string> = {
  ADMIN: 'bg-purple-500 ring-white',
  HEAD_OF_SALES: 'bg-indigo-500 ring-white',
  SALES_REPRESENTATIVE: 'bg-cyan-500 ring-white',
  DESIGNER: 'bg-emerald-500 ring-white',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  role,
  size = 'md',
  className = '',
  showRoleDot = false,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const initial = (name || 'U').trim().charAt(0).toUpperCase();

  const fallbackStyle = role
    ? roleColors[role]
    : 'bg-slate-900 text-slate-100 border-slate-700';

  const hasValidImage = Boolean(avatarUrl && !imageError);

  const containerClasses = `relative inline-flex items-center justify-center flex-shrink-0 select-none rounded-full overflow-hidden ${sizeClasses[size]} ${
    hasValidImage ? 'border border-slate-200/80 bg-slate-100 shadow-2xs' : `border font-semibold ${fallbackStyle} shadow-2xs`
  } ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`;

  return (
    <div className="relative inline-flex flex-shrink-0" onClick={onClick}>
      <div className={containerClasses}>
        {hasValidImage ? (
          <img
            src={avatarUrl!}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {showRoleDot && role && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ${
            size === 'xs' || size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3'
          } ${roleDotColors[role]}`}
          title={role.replace(/_/g, ' ')}
        />
      )}
    </div>
  );
};
