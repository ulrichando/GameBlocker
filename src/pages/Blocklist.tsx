import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Search, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export function Blocklist({ onBack }: BlocklistPageProps) {
  const [categories, setCategories] = useState<BlocklistCategory[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [newItem, setNewItem] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
  const filteredItems = currentCategory?.items.filter((item) =>
    item.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Blocklist</h1>
            <p className="text-sm text-muted-foreground">Manage blocked items</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {categories.map((category, index) => (
            <button
              key={category.name}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === index
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {category.name}
              <Badge variant="secondary" className="ml-2">
                {category.items.length}
              </Badge>
            </button>
          ))}
        </div>

        {/* Search and Add */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={activeTab === 0 ? "process.exe" : "example.com"}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
            <Button onClick={handleAddItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Items List */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredItems && filteredItems.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredItems.map((item) => (
                  <div
                    key={item.value}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      item.is_allowed
                        ? "bg-green-50 dark:bg-green-900/20"
                        : "bg-gray-50 dark:bg-gray-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.is_allowed ? (
                        <ShieldOff className="h-4 w-4 text-green-600" />
                      ) : (
                        <Shield className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-mono text-sm">{item.value}</span>
                      {item.is_default && (
                        <Badge variant="outline" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {item.is_allowed && (
                        <Badge variant="success" className="text-xs">
                          Allowed
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleWhitelist(item)}
                        title={item.is_allowed ? "Block this item" : "Allow this item"}
                      >
                        {item.is_allowed ? (
                          <Shield className="h-4 w-4" />
                        ) : (
                          <ShieldOff className="h-4 w-4" />
                        )}
                      </Button>
                      {!item.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.value)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No items match your search" : "No items in this category"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-600" />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-green-600" />
            <span>Allowed (whitelisted)</span>
          </div>
        </div>
      </main>
    </div>
  );
}
