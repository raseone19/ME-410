/**
 * App Sidebar Component
 * Main navigation sidebar for the Motor Control Dashboard
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gauge, Radar, Grid3x3, Activity, Stethoscope, Settings } from 'lucide-react';
import { useWebSocketStore, TRANSITION_PAUSE_MS } from '@/lib/websocket-store';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';

// Navigation data for the motor control dashboard
const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '/',
      icon: Gauge,
      items: [
        {
          title: 'Overview',
          url: '/',
        },
      ],
    },
    {
      title: 'Visualization',
      url: '#',
      icon: Radar,
      items: [
        {
          title: 'Radar View',
          url: '/radar',
        },
      ],
    },
    {
      title: 'Motors',
      url: '#',
      icon: Grid3x3,
      items: [
        {
          title: 'Motor 1',
          url: '/motor/1',
        },
        {
          title: 'Motor 2',
          url: '/motor/2',
        },
        {
          title: 'Motor 3',
          url: '/motor/3',
        },
        {
          title: 'Motor 4',
          url: '/motor/4',
        },
      ],
    },
    {
      title: 'Tuning',
      url: '#',
      icon: Settings,
      items: [
        {
          title: 'PI Controller',
          url: '/tuning',
        },
      ],
    },
    {
      title: 'Diagnostics',
      url: '#',
      icon: Stethoscope,
      items: [
        {
          title: 'System Health',
          url: '/diagnostics',
        },
        {
          title: 'Sensor Debug',
          url: '/sensors',
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const pauseTemporarily = useWebSocketStore((state) => state.pauseTemporarily);

  const handleNavigation = React.useCallback(() => {
    // Pause data processing during page transition
    pauseTemporarily(TRANSITION_PAUSE_MS);
  }, [pauseTemporarily]);

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Activity className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Motor Control</span>
                  <span className="text-xs">ESP32 Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className="font-medium">
                      {Icon && <Icon className="mr-2 size-4" />}
                      {item.title}
                    </a>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <SidebarMenuSub>
                      {item.items.map((subItem) => {
                        const isActive = pathname === subItem.url;
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <Link href={subItem.url} onClick={handleNavigation}>
                                {subItem.title}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
