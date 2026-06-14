import { useEffect, useMemo, useState } from "react";
import type { ComponentType, KeyboardEvent, SVGProps } from "react";
import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BadgeDollarSignIcon,
  ChevronRightIcon,
  GaugeIcon,
  RefreshCwIcon,
  Rows3Icon,
  ShieldCheckIcon,
  StoreIcon
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AppListSnapshot, AppSummary, CountryPrice, ProductComparison, Snapshot, TargetSnapshot } from "@/types";

type LoadState = "idle" | "loading" | "success" | "error";
type TargetSnapshotMeta = {
  generatedAt: string;
  baseCurrency: string;
  exchangeUpdatedAt: string | null;
};

export default function App() {
  const [appList, setAppList] = useState<AppListSnapshot | null>(null);
  const [targetSnapshots, setTargetSnapshots] = useState<Record<string, TargetSnapshot>>({});
  const [targetSnapshotMeta, setTargetSnapshotMeta] = useState<Record<string, TargetSnapshotMeta>>({});
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState(() => getInitialActiveTarget());
  const [refreshingTarget, setRefreshingTarget] = useState<string | null>(null);

  const loading = status === "loading";
  const selectedApp = useMemo(() => {
    if (!appList || !activeTarget) {
      return null;
    }
    return appList.apps.find((app) => app.appId === activeTarget) || null;
  }, [activeTarget, appList]);
  const selectedTarget = useMemo(() => {
    if (!activeTarget) {
      return null;
    }
    return targetSnapshots[activeTarget] || null;
  }, [activeTarget, targetSnapshots]);
  const selectedTargetMeta = activeTarget ? targetSnapshotMeta[activeTarget] || null : null;
  const showingAppList = !activeTarget;

  async function requestApps(forceRefresh = false) {
    const url = new URL("/api/apps", window.location.origin);
    if (forceRefresh) {
      url.searchParams.set("refresh", "1");
    }

    const response = await fetch(url, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Apps request failed: HTTP ${response.status}`);
    }
    return (await response.json()) as AppListSnapshot;
  }

  async function requestSnapshot(targetAppId?: string, forceRefresh = false) {
    const url = new URL("/api/snapshot", window.location.origin);
    if (targetAppId) {
      url.searchParams.set("appId", targetAppId);
    }
    if (forceRefresh) {
      url.searchParams.set("refresh", "1");
    }

    const response = await fetch(url, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Snapshot request failed: HTTP ${response.status}`);
    }
    return (await response.json()) as Snapshot;
  }

  async function loadSnapshot(forceRefresh = false) {
    setStatus("loading");
    setError(null);
    try {
      const nextAppList = await requestApps(forceRefresh);
      setAppList(nextAppList);
      setActiveTarget((current) => {
        if (!current || nextAppList.apps.some((app) => app.appId === current)) {
          return current;
        }
        replaceAppPath("");
        return "";
      });
      setStatus("success");
    } catch (loadError) {
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Unable to load snapshot");
    }
  }

  async function refreshTarget(appId: string, forceRefresh = false) {
    setRefreshingTarget(appId);
    setError(null);
    try {
      const partialSnapshot = await requestSnapshot(appId, forceRefresh);
      setTargetSnapshots((current) => mergeTargetSnapshots(current, partialSnapshot));
      setTargetSnapshotMeta((current) => mergeTargetSnapshotMeta(current, partialSnapshot));
      setStatus("success");
    } catch (refreshError) {
      setStatus("error");
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh app");
    } finally {
      setRefreshingTarget((current) => (current === appId ? null : current));
    }
  }

  function openTarget(appId: string) {
    setActiveTarget(appId);
    pushAppPath(appId);
    window.scrollTo({ top: 0 });
  }

  function openAppList() {
    setActiveTarget("");
    pushAppPath("");
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    void loadSnapshot();
    const handlePopState = () => {
      setActiveTarget(getInitialActiveTarget());
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!activeTarget || targetSnapshots[activeTarget] || refreshingTarget === activeTarget) {
      return;
    }
    void refreshTarget(activeTarget);
  }, [activeTarget, refreshingTarget, targetSnapshots]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StoreIcon className="size-4" />
              <span>App Store Price Monitor</span>
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="truncate text-2xl font-semibold tracking-normal sm:text-3xl">
                {selectedTarget?.name || selectedApp?.name || "Monitored Apps"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedTargetMeta && selectedTarget
                  ? `${formatDateTime(selectedTargetMeta.generatedAt)} · ${selectedTargetMeta.baseCurrency} base`
                  : appList
                    ? `${formatDateTime(appList.generatedAt)} · ${appList.baseCurrency} base`
                  : "Fetching current App Store data"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {appList ? <Badge variant="outline">{appList.apps.length} apps</Badge> : null}
          </div>
        </header>

        {appList && showingAppList ? <SummaryGrid appList={appList} /> : null}

        {!appList && loading ? <LoadingDashboard /> : null}
        {status === "error" && !appList ? <ErrorState message={error} onRetry={() => void loadSnapshot(true)} /> : null}
        {status === "error" && appList ? <InlineError message={error} /> : null}
        {appList && showingAppList ? (
          <AppDirectory
            appList={appList}
            targetSnapshots={targetSnapshots}
            refreshingTarget={refreshingTarget}
            onOpenTarget={openTarget}
            onRefreshTarget={(appId) => refreshTarget(appId, true)}
          />
        ) : null}
        {appList && selectedApp && activeTarget && !selectedTarget ? (
          status === "error" && refreshingTarget !== activeTarget ? (
            <AppDetailError
              app={selectedApp}
              message={error}
              onBack={openAppList}
              onRetry={() => void refreshTarget(activeTarget, true)}
            />
          ) : (
            <AppDetailLoading app={selectedApp} refreshing={refreshingTarget === activeTarget} onBack={openAppList} />
          )
        ) : null}
        {appList && selectedTarget ? (
          <AppDetailPage
            target={selectedTarget}
            generatedAt={selectedTargetMeta?.generatedAt || appList.generatedAt}
            baseCurrency={selectedTargetMeta?.baseCurrency || appList.baseCurrency}
            exchangeUpdatedAt={selectedTargetMeta?.exchangeUpdatedAt || null}
            refreshing={refreshingTarget === selectedTarget.appId}
            onBack={openAppList}
            onRefreshTarget={(appId) => refreshTarget(appId, true)}
          />
        ) : null}
      </div>
    </main>
  );
}

function AppIcon({
  name,
  iconUrl,
  size
}: {
  name: string;
  iconUrl: string | null | undefined;
  size: "sm" | "lg";
}) {
  const rootShapeClassName = size === "lg" ? "rounded-xl after:rounded-xl" : "rounded-md after:rounded-md";
  const childShapeClassName = size === "lg" ? "rounded-xl" : "rounded-md";

  return (
    <Avatar size={size} className={rootShapeClassName}>
      {iconUrl ? (
        <AvatarImage src={iconUrl} alt="" referrerPolicy="no-referrer" className={childShapeClassName} />
      ) : null}
      <AvatarFallback className={cn(childShapeClassName, "font-medium")}>{formatAppInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

function SummaryGrid({ appList }: { appList: AppListSnapshot }) {
  return (
    <Card size="sm" className="rounded-lg bg-muted/20 [--card-spacing:--spacing(2)]">
      <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <MetricItem icon={StoreIcon} label="Apps" value={String(appList.apps.length)} />
        <MetricItem icon={BadgeDollarSignIcon} label="Base" value={appList.baseCurrency} />
        <MetricItem icon={ActivityIcon} label="App info" value={formatDate(appList.generatedAt)} />
        <MetricItem icon={GaugeIcon} label="Pricing" value="Per app" />
      </CardContent>
    </Card>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tracking-normal">{value}</span>
    </div>
  );
}

function AppDirectory({
  appList,
  targetSnapshots,
  refreshingTarget,
  onOpenTarget,
  onRefreshTarget
}: {
  appList: AppListSnapshot;
  targetSnapshots: Record<string, TargetSnapshot>;
  refreshingTarget: string | null;
  onOpenTarget: (appId: string) => void;
  onRefreshTarget: (appId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium tracking-normal">Apps</h2>
          <p className="text-sm text-muted-foreground">Select an app to compare subscription prices by plan.</p>
        </div>
        <div className="text-sm text-muted-foreground">Pricing loads after selecting an app.</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {appList.apps.map((app) => (
          <AppDirectoryCard
            key={app.appId}
            app={app}
            baseCurrency={appList.baseCurrency}
            loadedTarget={targetSnapshots[app.appId] || null}
            refreshing={refreshingTarget === app.appId}
            onOpen={() => onOpenTarget(app.appId)}
            onRefresh={() => onRefreshTarget(app.appId)}
          />
        ))}
      </div>
    </section>
  );
}

function AppDirectoryCard({
  app,
  baseCurrency,
  loadedTarget,
  refreshing,
  onOpen,
  onRefresh
}: {
  app: AppSummary;
  baseCurrency: string;
  loadedTarget: TargetSnapshot | null;
  refreshing: boolean;
  onOpen: () => void;
  onRefresh: () => void;
}) {
  const lowestPrice = loadedTarget ? findLowestTargetPrice(loadedTarget) : null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="cursor-pointer rounded-lg transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <AppIcon name={app.name} iconUrl={app.iconUrl} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>{app.name}</span>
              <Badge variant="outline">{app.platform}</Badge>
            </CardTitle>
            <CardDescription className="line-clamp-2">{app.description || `App ID ${app.appId}`}</CardDescription>
          </div>
        </div>
        <CardAction className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`Refresh ${app.name}`}
                disabled={refreshing}
                onClick={(event) => {
                  event.stopPropagation();
                  onRefresh();
                }}
                size="icon-sm"
                variant="outline"
              >
                {refreshing ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh this app</TooltipContent>
          </Tooltip>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {loadedTarget ? (
          <>
            <Badge variant="secondary">{formatOfferCount(getComparableOffers(loadedTarget).length)}</Badge>
            <Badge variant="outline">{loadedTarget.countryCount} regions</Badge>
            <span className="font-medium text-foreground">
              Lowest {lowestPrice ? formatMoney(lowestPrice.priceInBase, baseCurrency) : "-"}
            </span>
          </>
        ) : (
          <>
            <Badge variant="secondary">Pricing on demand</Badge>
            {app.artistName ? <Badge variant="outline">{app.artistName}</Badge> : null}
            {app.primaryGenreName ? <span>{app.primaryGenreName}</span> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AppDetailPage({
  target,
  generatedAt,
  baseCurrency,
  exchangeUpdatedAt,
  refreshing,
  onBack,
  onRefreshTarget
}: {
  target: TargetSnapshot;
  generatedAt: string;
  baseCurrency: string;
  exchangeUpdatedAt: string | null;
  refreshing: boolean;
  onBack: () => void;
  onRefreshTarget: (appId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onBack} variant="ghost" className="w-fit">
          <ArrowLeftIcon data-icon="inline-start" />
          Apps
        </Button>
        <div className="text-sm text-muted-foreground">
          {exchangeUpdatedAt
            ? `Exchange updated ${formatDateTime(exchangeUpdatedAt)}`
            : `Prices loaded ${formatDateTime(generatedAt)}`}
        </div>
      </div>
      <TargetPanel
        target={target}
        baseCurrency={baseCurrency}
        refreshing={refreshing}
        onRefresh={() => onRefreshTarget(target.appId)}
      />
    </section>
  );
}

function AppDetailLoading({
  app,
  refreshing,
  onBack
}: {
  app: AppSummary;
  refreshing: boolean;
  onBack: () => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <Button onClick={onBack} variant="ghost" className="w-fit">
        <ArrowLeftIcon data-icon="inline-start" />
        Apps
      </Button>
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <AppIcon name={app.name} iconUrl={app.iconUrl} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>{app.name}</span>
                <Badge variant="outline">{app.platform}</Badge>
              </CardTitle>
              <CardDescription className="line-clamp-2 max-w-3xl">{app.description || `App ID ${app.appId}`}</CardDescription>
            </div>
          </div>
          <CardAction>
            <Badge variant="secondary">{refreshing ? "Loading prices" : "Pricing on demand"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            <span>Fetching global prices for this app</span>
          </div>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    </section>
  );
}

function AppDetailError({
  app,
  message,
  onBack,
  onRetry
}: {
  app: AppSummary;
  message: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <Button onClick={onBack} variant="ghost" className="w-fit">
        <ArrowLeftIcon data-icon="inline-start" />
        Apps
      </Button>
      <Empty className="min-h-96 rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>Unable to load {app.name}</EmptyTitle>
          <EmptyDescription>{message || "The app price request failed."}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRetry} variant="outline">
            <RefreshCwIcon data-icon="inline-start" />
            Retry this app
          </Button>
        </EmptyContent>
      </Empty>
    </section>
  );
}

function TargetPanel({
  target,
  baseCurrency,
  refreshing,
  onRefresh
}: {
  target: TargetSnapshot;
  baseCurrency: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const offers = getComparableOffers(target);

  return (
    <section className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-center gap-3">
            <AppIcon name={target.name} iconUrl={target.iconUrl} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>{target.name}</span>
                <Badge variant="outline">{target.platform}</Badge>
              </CardTitle>
              <CardDescription>
                {target.countryCount} supported countries · {target.filteredCountryCount} filtered · App ID{" "}
                {target.appId}
              </CardDescription>
              {target.description ? (
                <CardDescription className="line-clamp-2 max-w-3xl">{target.description}</CardDescription>
              ) : null}
            </div>
          </div>
          <CardAction className="flex items-center gap-2">
            <Badge variant="secondary">{formatOfferCount(offers.length)}</Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button disabled={refreshing} onClick={onRefresh} size="sm" variant="outline">
                  {refreshing ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh this app</TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
      </Card>

      {offers.length ? (
        <OfferExplorer offers={offers} baseCurrency={baseCurrency} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheckIcon />
            </EmptyMedia>
            <EmptyTitle>No in-app prices</EmptyTitle>
            <EmptyDescription>No supported storefront returned visible subscription or in-app purchase prices.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent />
        </Empty>
      )}
    </section>
  );
}

function OfferExplorer({ offers, baseCurrency }: { offers: ProductComparison[]; baseCurrency: string }) {
  const [activeOfferKey, setActiveOfferKey] = useState(offers[0]?.key || "");
  const activeOffer = offers.find((offer) => offer.key === activeOfferKey) || offers[0];
  const offerGroups = useMemo(() => groupOffersByKind(offers), [offers]);

  useEffect(() => {
    if (!offers.some((offer) => offer.key === activeOfferKey)) {
      setActiveOfferKey(offers[0]?.key || "");
    }
  }, [activeOfferKey, offers]);

  if (!activeOffer) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <Card className="rounded-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Rows3Icon className="size-4" />
              <span>Offer</span>
              <Badge variant="outline">{formatOfferCount(offers.length)}</Badge>
            </CardTitle>
            <CardDescription>Choose a subscription or in-app purchase, then compare country / region prices below.</CardDescription>
          </div>
          <div className="w-full sm:w-[420px]">
            <OfferSelect
              activeOfferKey={activeOffer.key}
              baseCurrency={baseCurrency}
              offerGroups={offerGroups}
              onChange={setActiveOfferKey}
            />
          </div>
        </CardHeader>
      </Card>

      <OfferCard offer={activeOffer} baseCurrency={baseCurrency} />
    </section>
  );
}

function OfferSelect({
  activeOfferKey,
  baseCurrency,
  offerGroups,
  onChange,
}: {
  activeOfferKey: string;
  baseCurrency: string;
  offerGroups: Array<{ kind: string; offers: ProductComparison[] }>;
  onChange: (key: string) => void;
}) {
  return (
    <Select value={activeOfferKey} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue placeholder="Select an offer" />
      </SelectTrigger>
      <SelectContent align="end" className="max-h-[24rem] sm:min-w-[420px]" position="popper">
        {offerGroups.map((group) => (
          <SelectGroup key={group.kind}>
            <SelectLabel className="flex items-center justify-between gap-2">
              <span>{group.kind}</span>
              <span>{group.offers.length}</span>
            </SelectLabel>
            {group.offers.map((offer) => (
              <SelectItem key={offer.key} value={offer.key}>
                {formatOfferOption(offer, baseCurrency)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function OfferCard({ offer, baseCurrency }: { offer: ProductComparison; baseCurrency: string }) {
  const cheapestPrice = findCheapestPrice(offer.prices);
  const highestPrice = findHighestPrice(offer.prices);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>{offer.name}</span>
          <Badge variant="outline">{formatOfferKind(offer)}</Badge>
        </CardTitle>
        <CardAction>
          <Badge variant="secondary">Lowest first</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)]">
          <div className="flex min-h-36 flex-col justify-between rounded-lg bg-primary p-4 text-primary-foreground">
            <div className="flex items-center gap-2 text-sm">
              <ArrowDownIcon className="size-4" />
              <span>Lowest converted price</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="truncate text-3xl font-semibold tracking-normal">
                {formatMoney(offer.stats?.min, baseCurrency)}
              </div>
              <div className="text-sm text-primary-foreground/80">
                Cheapest market: {formatCountryLabel(cheapestPrice)}
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatBlock
              icon={GaugeIcon}
              label="Median"
              value={formatMoney(offer.stats?.median, baseCurrency)}
              detail={`Spread ${formatMoney(offer.stats?.spread, baseCurrency)}`}
            />
            <StatBlock
              icon={ActivityIcon}
              label="Average"
              value={formatMoney(offer.stats?.average, baseCurrency)}
              detail="Converted average"
            />
            <StatBlock
              icon={ArrowUpIcon}
              label="Highest"
              value={formatMoney(offer.stats?.max, baseCurrency)}
              detail={formatCountryLabel(highestPrice)}
            />
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[460px] max-h-[65vh] rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Country / Region</TableHead>
                <TableHead>Local price</TableHead>
                <TableHead className="text-right">{baseCurrency}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offer.prices.map((price, index) => (
                <TableRow key={`${offer.key}:${price.country}`} className={cn(index === 0 && "bg-muted/30")}>
                  <TableCell>
                    <Badge variant={index === 0 ? "default" : "secondary"}>#{index + 1}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <RegionFlag country={price.country} />
                      <span className="font-medium">{formatCountryLabel(price)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{price.localPrice || "-"}</span>
                      {price.currency ? <Badge variant="outline">{price.currency}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(price.priceInBase, baseCurrency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function RegionFlag({ country }: { country: string | null | undefined }) {
  const flag = formatRegionFlag(country);
  if (!flag) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm border bg-muted/30"
      title={`Storefront region ${country?.toUpperCase()}`}
    >
      {flag}
    </span>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-32 flex-col justify-between rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="truncate text-lg font-semibold tracking-normal">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

function findCheapestPrice(prices: CountryPrice[]) {
  return prices.find((price) => Number.isFinite(price.priceInBase)) || null;
}

function findHighestPrice(prices: CountryPrice[]) {
  for (let index = prices.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(prices[index].priceInBase)) {
      return prices[index];
    }
  }
  return null;
}

function findLowestTargetPrice(target: TargetSnapshot) {
  return (
    getComparableOffers(target)
      .flatMap((offer) => offer.prices)
      .filter((price) => Number.isFinite(price.priceInBase))
      .sort((first, second) => Number(first.priceInBase) - Number(second.priceInBase))[0] || null
  );
}

function formatCountryLabel(price: CountryPrice | null) {
  if (!price) {
    return "-";
  }
  return price.countryName || price.country;
}

function formatRegionFlag(country: string | null | undefined) {
  const code = country?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) {
    return null;
  }

  return Array.from(code)
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function formatAppInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return initials || "A";
}

function LoadingDashboard() {
  return (
    <div className="flex flex-col gap-5">
      <Card size="sm" className="rounded-lg bg-muted/20 [--card-spacing:--spacing(2)]">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
      <section className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="rounded-lg">
            <CardHeader>
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function InlineError({ message }: { message: string | null }) {
  return (
    <Card size="sm" className="rounded-lg bg-muted/20">
      <CardContent className="text-sm text-muted-foreground">
        {message || "The latest app refresh failed. Existing data is still shown."}
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <Empty className="min-h-96">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldCheckIcon />
        </EmptyMedia>
        <EmptyTitle>Unable to load prices</EmptyTitle>
        <EmptyDescription>{message || "The snapshot request failed."}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => void onRetry()} variant="outline">
          <RefreshCwIcon data-icon="inline-start" />
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function formatMoney(value: number | null | undefined, currency: string) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(2)} ${currency}`;
}

function formatOfferCount(count: number) {
  return `${count} ${count === 1 ? "offer" : "offers"}`;
}

function getComparableOffers(target: TargetSnapshot) {
  return [...target.subscriptionPlans, ...target.oneTimePurchases];
}

function formatOfferKind(offer: ProductComparison) {
  return offer.billingPeriod ? formatPeriod(offer.billingPeriod) : "In-app purchase";
}

function formatPeriod(period: string | null) {
  const labels: Record<string, string> = {
    P1D: "Daily",
    P1W: "Weekly",
    P1M: "Monthly",
    P3M: "Quarterly",
    P1Y: "Yearly"
  };
  return period ? labels[period] || period : "Subscription";
}

function formatOfferOption(offer: ProductComparison, currency: string) {
  return `${offer.name} · ${formatOfferKind(offer)} · ${formatMoney(offer.stats?.min, currency)}`;
}

function groupOffersByKind(offers: ProductComparison[]) {
  const groups = new Map<string, ProductComparison[]>();
  for (const offer of offers) {
    const kind = formatOfferKind(offer);
    groups.set(kind, [...(groups.get(kind) || []), offer]);
  }

  return Array.from(groups, ([kind, groupOffers]) => ({
    kind,
    offers: groupOffers
  }));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function getInitialActiveTarget() {
  const match = window.location.pathname.match(/^\/apps\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function pushAppPath(appId: string) {
  window.history.pushState(null, "", appId ? `/apps/${encodeURIComponent(appId)}` : "/apps");
}

function replaceAppPath(appId: string) {
  window.history.replaceState(null, "", appId ? `/apps/${encodeURIComponent(appId)}` : "/apps");
}

function mergeTargetSnapshots(current: Record<string, TargetSnapshot>, partial: Snapshot) {
  const refreshedTarget = partial.targets[0];
  if (!refreshedTarget) {
    return current;
  }

  return {
    ...current,
    [refreshedTarget.appId]: refreshedTarget
  };
}

function mergeTargetSnapshotMeta(current: Record<string, TargetSnapshotMeta>, partial: Snapshot) {
  const refreshedTarget = partial.targets[0];
  if (!refreshedTarget) {
    return current;
  }

  return {
    ...current,
    [refreshedTarget.appId]: {
      generatedAt: partial.generatedAt,
      baseCurrency: partial.baseCurrency,
      exchangeUpdatedAt: partial.exchange.updatedAt
    }
  };
}
