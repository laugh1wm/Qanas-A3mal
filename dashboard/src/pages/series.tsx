import { Layout } from "@/components/layout";
import { 
  useListSeries, 
  useDeleteSeries, 
  useSearchManga, 
  useTrackSeries,
  getListSeriesQueryKey
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, ExternalLink, Globe, BookOpen } from "lucide-react";
import { format } from "date-fns";

export default function Series() {
  const { data: series, isLoading } = useListSeries();
  const deleteSeries = useDeleteSeries();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Stop tracking ${title}?`)) return;
    
    deleteSeries.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Series removed", description: `Stopped tracking ${title}` });
        queryClient.invalidateQueries({ queryKey: getListSeriesQueryKey() });
      }
    });
  };

  const filteredSeries = series?.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.titleAr && s.titleAr.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tracked Series</h1>
          <p className="text-muted-foreground mt-1">Manage manga and manhwa being monitored.</p>
        </div>
        <AddSeriesDialog />
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search tracked series..." 
          className="pl-10 max-w-md bg-card"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse bg-card/50">
              <CardContent className="p-6 h-40" />
            </Card>
          ))}
        </div>
      ) : filteredSeries?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border border-dashed">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No series found</h3>
          <p className="text-muted-foreground mt-1">Add a new series to start tracking updates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSeries?.map((s) => (
            <Card key={s.id} className="overflow-hidden flex flex-col group relative">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80 backdrop-blur-sm rounded-md shadow-sm">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(s.id, s.title)}
                  title="Stop tracking"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex h-36 border-b border-border">
                {s.coverUrl ? (
                  <img src={s.coverUrl} alt={s.title} className="w-24 object-cover border-r border-border shrink-0" />
                ) : (
                  <div className="w-24 bg-muted flex items-center justify-center border-r border-border shrink-0">
                    <BookOpen className="w-8 h-8 text-muted-foreground opacity-50" />
                  </div>
                )}
                <div className="p-4 flex-1 min-w-0 flex flex-col">
                  <h3 className="font-bold text-base leading-tight line-clamp-2" title={s.title}>
                    {s.title}
                  </h3>
                  {s.titleAr && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1" dir="rtl">
                      {s.titleAr}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-2">
                    <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-sm font-medium">
                      Ch. {s.latestChapter || '?'}
                    </span>
                    {s.hasArabicTranslation && (
                      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-sm font-medium flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        AR
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-muted/30 px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  {s.isActive ? 'Active' : 'Inactive'}
                </div>
                <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                  {s.sourceName} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}

function AddSeriesDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  
  const { data: results, isLoading: isSearching, refetch } = useSearchManga(
    { q: query },
    { query: { enabled: false } }
  );
  
  const trackSeries = useTrackSeries();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setHasSearched(true);
    refetch();
  };

  const handleTrack = (result: any) => {
    trackSeries.mutate({
      data: {
        externalId: result.id,
        title: result.title,
        titleAr: result.titleAr,
        coverUrl: result.coverUrl,
        language: result.language,
        hasArabicTranslation: result.hasArabicTranslation,
        latestChapter: result.latestChapters?.[0]?.chapterNumber
      }
    }, {
      onSuccess: () => {
        toast({ title: "Series Added", description: `Started tracking ${result.title}` });
        queryClient.invalidateQueries({ queryKey: getListSeriesQueryKey() });
        setOpen(false);
        setQuery("");
        setHasSearched(false);
      },
      onError: (err: any) => {
        toast({ 
          title: "Error", 
          description: err.response?.data?.error || "Failed to add series. It might already be tracked.", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Track New Series
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search MangaDex</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSearch} className="flex gap-2 mt-4">
          <Input 
            placeholder="Manga title..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </form>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {isSearching ? (
            <div className="py-8 text-center text-muted-foreground">Searching MangaDex...</div>
          ) : hasSearched && results?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No results found</div>
          ) : (
            <div className="space-y-3">
              {results?.map((res) => (
                <div key={res.id} className="flex gap-4 p-3 border border-border rounded-lg hover:bg-muted/20">
                  {res.coverUrl ? (
                    <img src={res.coverUrl} alt={res.title} className="w-16 h-24 object-cover rounded-sm shrink-0" />
                  ) : (
                    <div className="w-16 h-24 bg-muted flex items-center justify-center shrink-0 rounded-sm">
                      <BookOpen className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="font-bold text-sm line-clamp-1">{res.title}</h4>
                    {res.titleAr && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" dir="rtl">{res.titleAr}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
                        {res.language}
                      </span>
                      {res.hasArabicTranslation && (
                        <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-sm">
                          Arabic Available
                        </span>
                      )}
                      {res.latestChapters?.[0] && (
                        <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
                          Latest: {res.latestChapters[0].chapterNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Button 
                      size="sm" 
                      onClick={() => handleTrack(res)}
                      disabled={trackSeries.isPending}
                    >
                      Track
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
