import { Layout } from "@/components/layout";
import { useListNotifications } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, ExternalLink, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Notifications() {
  // Pass an empty object to satisfy the params requirement
  const { data: notifications, isLoading } = useListNotifications({ query: {} } as any);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Notification History</h1>
        <p className="text-muted-foreground mt-1">Log of all chapter updates sent to Discord.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[300px]">Series</TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="text-right">Notified At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4} className="h-16">
                      <div className="w-full h-full bg-muted/50 animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : notifications?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    No notifications sent yet.
                  </TableCell>
                </TableRow>
              ) : (
                notifications?.map((notif) => (
                  <TableRow key={notif.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {notif.coverUrl ? (
                          <img src={notif.coverUrl} className="w-8 h-12 object-cover rounded-sm shadow-sm" alt="" />
                        ) : (
                          <div className="w-8 h-12 bg-muted flex items-center justify-center rounded-sm">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="line-clamp-2 leading-tight">{notif.seriesTitle}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold w-fit">
                          Ch. {notif.chapterNumber}
                        </span>
                        {notif.chapterTitle && (
                          <span className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]" title={notif.chapterTitle}>
                            {notif.chapterTitle}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {notif.chapterUrl && (
                        <a 
                          href={notif.chapterUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Read Chapter"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock className="w-3 h-3" />
                        {format(new Date(notif.notifiedAt), "MMM d, HH:mm")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  );
}
