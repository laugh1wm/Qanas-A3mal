import { Layout } from "@/components/layout";
import { useGetStats, useListNotifications, useTriggerCheck, getGetStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Server, Bell, Globe, RefreshCcw, Activity } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: recentNotifications, isLoading: notifsLoading } = useListNotifications({ query: { limit: 5 } });
  
  const triggerCheck = useTriggerCheck();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleTrigger = () => {
    triggerCheck.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Update triggered",
          description: "Checking sources for new chapters...",
        });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to trigger update check",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">System status and key metrics at a glance.</p>
        </div>
        <Button 
          onClick={handleTrigger} 
          disabled={triggerCheck.isPending}
          className="gap-2 self-start md:self-auto"
        >
          <RefreshCcw className={`w-4 h-4 ${triggerCheck.isPending ? "animate-spin" : ""}`} />
          Force Check Updates
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title="Tracked Series" 
          value={stats?.totalSeries} 
          icon={BookOpen} 
          loading={statsLoading} 
        />
        <MetricCard 
          title="Active Servers" 
          value={stats?.totalServers} 
          icon={Server} 
          loading={statsLoading} 
        />
        <MetricCard 
          title="Notifications Sent" 
          value={stats?.totalNotifications} 
          icon={Bell} 
          loading={statsLoading} 
        />
        <MetricCard 
          title="Arabic Translations" 
          value={stats?.arabicTranslated} 
          icon={Globe} 
          loading={statsLoading} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Dispatches</CardTitle>
            </CardHeader>
            <CardContent>
              {notifsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                  ))}
                </div>
              ) : recentNotifications?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent notifications
                </div>
              ) : (
                <div className="space-y-4">
                  {recentNotifications?.map((notif) => (
                    <div key={notif.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        {notif.coverUrl ? (
                          <img src={notif.coverUrl} alt="" className="w-10 h-14 object-cover rounded-sm shadow-sm" />
                        ) : (
                          <div className="w-10 h-14 bg-muted rounded-sm flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-1">{notif.seriesTitle}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary font-mono">
                              Ch. {notif.chapterNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(notif.notifiedAt), "MMM d, HH:mm")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground border-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-3">
                  <span className="text-primary-foreground/80 text-sm">Status</span>
                  <span className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    Operational
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-3">
                  <span className="text-primary-foreground/80 text-sm">Last Update Check</span>
                  <span className="font-mono text-sm">{stats?.recentlyUpdated || 0} updated</span>
                </div>
                <div className="pt-2">
                  <p className="text-xs text-primary-foreground/60 leading-relaxed">
                    Qannas operations are running normally. Tracking {stats?.totalSeries || 0} series across {stats?.totalServers || 0} servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function MetricCard({ title, value, icon: Icon, loading }: { title: string, value?: number, icon: any, loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="p-2 bg-primary/5 rounded-md">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold font-mono tracking-tight">{value ?? 0}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
