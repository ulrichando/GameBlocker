import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Search, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TitleBar } from "@/components/TitleBar";
import { invoke } from "@tauri-apps/api/core";

interface BlocklistPageProps {
  onBack: () => void;
}

interface BlocklistItem {
  value: string;
  is_default: boolean;
  is_allowed: boolean;
}

interface BlocklistCategory {
  name: string;
  items: BlocklistItem[];
}

type FilterMode = "all" | "blocked" | "allowed";

export function Blocklist({ onBack }: BlocklistPageProps) {
  const [categories, setCategories] = useState<BlocklistCategory[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [newItem, setNewItem] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const fetchBlocklists = async () => {
    try {
      setIsLoading(true);
      const data = await invoke<BlocklistCategory[]>("get_blocklists");
      setCategories(data);
    } catch (error) {
      console.error("Failed to fetch blocklists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocklists();
  }, []);

  const currentCategory = categories[activeTab];
  const filteredItems = currentCategory?.items.filter((item) => {
    const matchesSearch = item.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterMode === "all" ||
      (filterMode === "allowed" && item.is_allowed) ||
      (filterMode === "blocked" && !item.is_allowed);
    return matchesSearch && matchesFilter;
  });

  const allowedCount = currentCategory?.items.filter((item) => item.is_allowed).length ?? 0;
  const blockedCount = currentCategory?.items.filter((item) => !item.is_allowed).length ?? 0;

  const handleAddItem = async () => {
    if (!newItem.trim()) return;

    try {
      if (activeTab === 0) {
        await invoke("add_blocked_process", { process: newItem });
      } else {
        await invoke("add_blocked_domain", { domain: newItem });
      }
      setNewItem("");
      fetchBlocklists();
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  };

  const handleRemoveItem = async (value: string) => {
    try {
      if (activeTab === 0) {
        await invoke("remove_blocked_process", { process: value });
      } else {
        await invoke("remove_blocked_domain", { domain: value });
      }
      fetchBlocklists();
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const handleToggleWhitelist = async (item: BlocklistItem) => {
    try {
      const itemType = activeTab === 0 ? "process" : "domain";
      if (item.is_allowed) {
        await invoke("remove_from_whitelist", { item: item.value, itemType });
      } else {
        await invoke("add_to_whitelist", { item: item.value, itemType });
      }
      fetchBlocklists();
    } catch (error) {
      console.error("Failed to toggle whitelist:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header - Fluent 2 Custom Title Bar */}
      <TitleBar>
        <div className="flex items-center px-2 gap-1 h-full">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-6 w-6 rounded hover:bg-foreground/10">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-semibold">Blocklist</span>
        </div>
      </TitleBar>

      <main className="flex-1 overflow-y-auto scrollable-content">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {categories.map((category, index) => (
            <button
              key={category.name}
              onClick={() => setActiveTab(index)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === index
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {category.name}
              <Badge variant="secondary" className="ml-1.5 text-xs rounded">
                {category.items.length}
              </Badge>
            </button>
          ))}
        </div>

        {/* Search and Add */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-9 h-8 text-sm rounded-md"
            />
          </div>
          <div className="flex gap-1.5">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={activeTab === 0 ? "process.exe" : "example.com"}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="h-8 text-sm rounded-md"
            />
            <Button onClick={handleAddItem} size="sm" className="h-8 w-8 p-0 rounded-md">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-1.5">
          <Button
            variant={filterMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("all")}
            className="rounded-md text-xs h-7"
          >
            All
            <Badge variant="secondary" className="ml-1.5 text-xs rounded">
              {currentCategory?.items.length ?? 0}
            </Badge>
          </Button>
          <Button
            variant={filterMode === "blocked" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("blocked")}
            className="rounded-md text-xs h-7"
          >
            <Shield className="h-3 w-3 mr-1 text-red-500" />
            Blocked
            <Badge variant="secondary" className="ml-1.5 text-xs rounded">
              {blockedCount}
            </Badge>
          </Button>
          <Button
            variant={filterMode === "allowed" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMode("allowed")}
            className="rounded-md text-xs h-7"
          >
            <ShieldOff className="h-3 w-3 mr-1 text-green-500" />
            Allowed
            <Badge variant="secondary" className="ml-1.5 text-xs rounded">
              {allowedCount}
            </Badge>
          </Button>
        </div>

        {/* Items List */}
        <Card className="fluent-card">
          <CardContent className="py-3 px-4">
            {isLoading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
            ) : filteredItems && filteredItems.length > 0 ? (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {filteredItems.map((item) => (
                  <div
                    key={item.value}
                    className={`flex items-center justify-between p-2 rounded-md ${
                      item.is_allowed
                        ? "bg-success/10"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.is_allowed ? (
                        <ShieldOff className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Shield className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className="font-mono text-xs text-foreground">{item.value}</span>
                      {item.is_default && (
                        <Badge variant="outline" className="text-caption-2 px-1 py-0 rounded">
                          Default
                        </Badge>
                      )}
                      {item.is_allowed && (
                        <Badge variant="success" className="text-caption-2 px-1 py-0 rounded">
                          Allowed
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleWhitelist(item)}
                        title={item.is_allowed ? "Block this item" : "Allow this item"}
                        className="h-6 w-6 p-0 rounded"
                      >
                        {item.is_allowed ? (
                          <Shield className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldOff className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {!item.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.value)}
                          className="h-6 w-6 p-0 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                {searchQuery
                  ? "No items match your search"
                  : filterMode === "allowed"
                  ? "No allowed items yet. Click the shield icon on any item to whitelist it."
                  : filterMode === "blocked"
                  ? "No blocked items"
                  : "No items in this category"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-destructive" />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldOff className="h-3 w-3 text-success" />
            <span>Allowed (whitelisted)</span>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
