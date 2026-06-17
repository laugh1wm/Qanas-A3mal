import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Bell, 
  BookOpen, 
  ServerCrash, 
  Sword,
  Menu
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Overview", href: "/", icon: Activity },
    { name: "Series", href: "/series", icon: BookOpen },
    { name: "Servers", href: "/servers", icon: ServerCrash },
    { name: "Notifications", href: "/notifications", icon: Bell },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
        <div className="bg-primary p-1.5 rounded-sm flex items-center justify-center">
          <Sword className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-bold tracking-tight text-lg text-primary-foreground">
          Qannas
        </span>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all ${
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 border-r border-border h-screen sticky top-0">
        <SidebarContent />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1 rounded-sm">
              <Sword className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight text-foreground">Qannas</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-10 overflow-auto">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
