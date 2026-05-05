import React from "react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Check,
  ChevronsUpDown,
  LogOut,
  Moon,
  Palette,
  Settings,
  Sun,
  User,
} from "lucide-react";
import type { ChatUserMenuSection } from "../../types/chatTypes";

export interface UserMenuConfig {
  labels?: {
    profile?: string;
    settings?: string;
    theme?: string;
    lightMode?: string;
    darkMode?: string;
    systemTheme?: string;
    logout?: string;
    guest?: string;
  };
}

export interface UserMenuUser {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export interface UserMenuCallbacks {
  onViewProfile?: () => void;
  onOpenSettings?: () => void;
  onThemeChange?: (theme: "light" | "dark" | "system") => void;
  onLogout?: () => void;
}

export interface UserMenuProps {
  user?: UserMenuUser | null;
  config?: UserMenuConfig;
  callbacks?: UserMenuCallbacks;
  currentTheme?: "light" | "dark" | "system";
  /** Show theme options in the menu */
  showThemeOptions?: boolean;
  /** Structured custom menu sections rendered natively by the menu */
  sections?: ChatUserMenuSection[];
  /** @deprecated Prefer sections for native menu composition */
  additionalItems?: React.ReactNode;
}

// Get initials from name or email
const getInitials = (name?: string, email?: string): string => {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
};

// Get display name
const getDisplayName = (
  user?: UserMenuUser | null,
  guestLabel?: string,
): string => {
  if (!user) return guestLabel || "Guest";
  return user.name || user.email?.split("@")[0] || guestLabel || "Guest";
};

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  config,
  callbacks,
  currentTheme = "system",
  showThemeOptions = true,
  sections = [],
  additionalItems,
}) => {
  const { isMobile } = useSidebar();

  const labels = {
    profile: config?.labels?.profile || "Profile",
    settings: config?.labels?.settings || "Settings",
    theme: config?.labels?.theme || "Theme",
    lightMode: config?.labels?.lightMode || "Light",
    darkMode: config?.labels?.darkMode || "Dark",
    systemTheme: config?.labels?.systemTheme || "System",
    logout: config?.labels?.logout || "Log out",
    guest: config?.labels?.guest || "Guest",
  };

  const displayName = getDisplayName(user, labels.guest);
  const initials = getInitials(user?.name, user?.email);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              tooltip={displayName}
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user?.avatar && (
                  <AvatarImage src={user.avatar} alt={displayName} />
                )}
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{displayName}</span>
                {user?.email && (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user?.avatar && (
                    <AvatarImage src={user.avatar} alt={displayName} />
                  )}
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  {user?.email && (
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Profile */}
            {callbacks?.onViewProfile && (
              <DropdownMenuItem onClick={callbacks.onViewProfile}>
                <User className="mr-2 h-4 w-4" />
                <span>{labels.profile}</span>
              </DropdownMenuItem>
            )}

            {/* Settings */}
            {callbacks?.onOpenSettings && (
              <DropdownMenuItem onClick={callbacks.onOpenSettings}>
                <Settings className="mr-2 h-4 w-4" />
                <span>{labels.settings}</span>
              </DropdownMenuItem>
            )}

            {/* Additional items */}
            {additionalItems}

            {/* Structured custom sections */}
            {sections.map((section) => (
              <React.Fragment key={section.id}>
                <DropdownMenuSeparator />
                {section.label && (
                  <DropdownMenuLabel className="px-2 py-2">
                    {section.label}
                  </DropdownMenuLabel>
                )}
                {section.items.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={item.onSelect}
                    disabled={item.disabled}
                    className={[
                      item.checked ? "bg-accent/60" : "",
                      item.variant === "destructive"
                        ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                        : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {item.icon && (
                      <span className="mr-2 h-4 w-4 shrink-0">{item.icon}</span>
                    )}
                    <span className="flex-1">{item.label}</span>
                    {item.checked && (
                      <Check className="ml-2 h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </React.Fragment>
            ))}

            {/* Theme options */}
            {showThemeOptions && callbacks?.onThemeChange && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => callbacks.onThemeChange?.("light")}
                  className={currentTheme === "light" ? "bg-accent" : ""}
                >
                  <Sun className="mr-2 h-4 w-4" />
                  <span>{labels.lightMode}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => callbacks.onThemeChange?.("dark")}
                  className={currentTheme === "dark" ? "bg-accent" : ""}
                >
                  <Moon className="mr-2 h-4 w-4" />
                  <span>{labels.darkMode}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => callbacks.onThemeChange?.("system")}
                  className={currentTheme === "system" ? "bg-accent" : ""}
                >
                  <Palette className="mr-2 h-4 w-4" />
                  <span>{labels.systemTheme}</span>
                </DropdownMenuItem>
              </>
            )}

            {/* Logout */}
            {callbacks?.onLogout && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={callbacks.onLogout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{labels.logout}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default UserMenu;
