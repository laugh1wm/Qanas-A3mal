import { Layout } from "@/components/layout";
import { useListServers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ServerCrash, Hash, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Servers() {
  const { data: servers, isLoading } = useListServers();

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Discord Servers</h1>
        <p className="text-muted-foreground mt-1">Servers currently connected to the Qannas bot.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse bg-card/50">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : servers?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border border-dashed">
          <ServerCrash className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No active servers</h3>
          <p className="text-muted-foreground mt-1">Invite the bot to a Discord server to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers?.map((server) => (
            <Card key={server.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate pr-4">
                    {server.guildName || `Server ${server.guildId}`}
                  </CardTitle>
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${server.isActive ? 'bg-green-500' : 'bg-destructive'}`} title={server.isActive ? 'Active' : 'Inactive'} />
                </div>
                <CardDescription className="font-mono text-xs mt-1">
                  ID: {server.guildId}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <Hash className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{server.channelName || "Unknown Channel"}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 font-mono">#{server.channelId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-muted-foreground">
                    Added {format(new Date(server.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
