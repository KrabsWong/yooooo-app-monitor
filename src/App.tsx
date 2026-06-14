import { useEffect, useMemo, useState } from "react";
import type { ComponentType, KeyboardEvent, SVGProps } from "react";
import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BadgeDollarSignIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GaugeIcon,
  RefreshCwIcon,
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
import { ThemeToggle } from "@/components/theme-toggle";
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
        <header className="relative flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-2 pr-32 md:pr-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StoreIcon className="size-4" />
              <span>App Store Price Monitor</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="min-w-0 truncate text-2xl font-semibold tracking-normal sm:text-3xl">
                  {selectedTarget?.name || selectedApp?.name || "Monitored Apps"}
                </h1>
                {appList && showingAppList ? <AppCountBadge count={appList.apps.length} /> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedTargetMeta && selectedTarget
                  ? `${formatDateTime(selectedTargetMeta.generatedAt)} · ${selectedTargetMeta.baseCurrency} base`
                  : appList
                    ? `${formatDateTime(appList.generatedAt)} · ${appList.baseCurrency} base`
                  : "Fetching current App Store data"}
              </p>
            </div>
          </div>
          <div className="absolute right-0 top-0 flex items-center gap-2 md:static">
            <ThemeToggle />
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
            storeCountry={selectedApp?.country || null}
            refreshing={refreshingTarget === selectedTarget.appId}
            onBack={openAppList}
            onRefreshTarget={(appId) => refreshTarget(appId, true)}
          />
        ) : null}
      </div>
    </main>
  );
}

function AppCountBadge({ count }: { count: number }) {
  return (
    <Badge className="h-7 gap-1.5 rounded-full px-3 text-sm font-semibold" variant="default">
      <StoreIcon data-icon="inline-start" />
      {count} apps
    </Badge>
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
  loadedTarget,
  refreshing,
  onOpen,
  onRefresh
}: {
  app: AppSummary;
  loadedTarget: TargetSnapshot | null;
  refreshing: boolean;
  onOpen: () => void;
  onRefresh: () => void;
}) {
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
          <AppStoreButton appId={app.appId} appName={app.name} country={app.country} compact />
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {loadedTarget ? (
          <>
            <Badge variant="secondary">{formatOfferCount(getComparableOffers(loadedTarget).length)}</Badge>
            <Badge variant="outline">{loadedTarget.countryCount} regions</Badge>
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

function AppStoreButton({
  appId,
  appName,
  className,
  country,
  compact = false
}: {
  appId: string;
  appName: string;
  className?: string;
  country?: string | null;
  compact?: boolean;
}) {
  const appStoreUrl = getAppStoreUrl(appId, country, appName);
  if (!appStoreUrl) {
    return null;
  }

  const label = `Open ${appName} in App Store`;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild className={className} size="icon-sm" variant="outline">
            <a
              aria-label={label}
              href={appStoreUrl}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon data-icon="inline-start" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open in App Store</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button asChild className={className} size="sm" variant="outline">
      <a
        aria-label={label}
        href={appStoreUrl}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLinkIcon data-icon="inline-start" />
        App Store
      </a>
    </Button>
  );
}

function AppDetailPage({
  target,
  generatedAt,
  baseCurrency,
  exchangeUpdatedAt,
  storeCountry,
  refreshing,
  onBack,
  onRefreshTarget
}: {
  target: TargetSnapshot;
  generatedAt: string;
  baseCurrency: string;
  exchangeUpdatedAt: string | null;
  storeCountry: string | null;
  refreshing: boolean;
  onBack: () => void;
  onRefreshTarget: (appId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button onClick={onBack} variant="ghost" className="w-fit">
          <ArrowLeftIcon data-icon="inline-start" />
          Apps
        </Button>
        <div className="text-xs text-muted-foreground sm:text-sm">
          {exchangeUpdatedAt
            ? `Exchange updated ${formatDateTime(exchangeUpdatedAt)}`
            : `Prices loaded ${formatDateTime(generatedAt)}`}
        </div>
      </div>
      <TargetPanel
        target={target}
        baseCurrency={baseCurrency}
        storeCountry={storeCountry}
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
  const appStoreUrl = getAppStoreUrl(app.appId, app.country, app.name);

  return (
    <section className="flex flex-col gap-5">
      <Button onClick={onBack} variant="ghost" className="w-fit">
        <ArrowLeftIcon data-icon="inline-start" />
        Apps
      </Button>
      <Card className="[--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
        <CardHeader className="has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-start gap-3">
            <AppIcon name={app.name} iconUrl={app.iconUrl} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate">{app.name}</span>
                <Badge variant="outline">{app.platform}</Badge>
              </CardTitle>
              <CardDescription className="line-clamp-2 max-w-3xl">{app.description || `App ID ${app.appId}`}</CardDescription>
            </div>
          </div>
          <CardAction className="col-start-1 row-span-1 row-start-auto mt-3 flex w-full flex-col items-stretch gap-2 justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:flex-row sm:items-center sm:justify-self-end">
            {appStoreUrl ? (
              <AppStoreButton
                appId={app.appId}
                appName={app.name}
                className="h-12 w-full text-base sm:h-7 sm:w-auto sm:text-[0.8rem]"
                country={app.country}
              />
            ) : null}
            <Badge className="w-fit" variant="secondary">
              {refreshing ? "Loading prices" : "Pricing on demand"}
            </Badge>
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
  storeCountry,
  refreshing,
  onRefresh
}: {
  target: TargetSnapshot;
  baseCurrency: string;
  storeCountry: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const offers = getComparableOffers(target);

  return (
    <section className="flex flex-col gap-5">
      <Card className="[--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
        <CardHeader className="has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-start gap-3">
            <AppIcon name={target.name} iconUrl={target.iconUrl} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate">{target.name}</span>
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
          <CardAction className="col-start-1 row-span-1 row-start-auto mt-3 flex w-full flex-col items-stretch gap-2 justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:flex-row sm:items-center sm:justify-self-end">
            <Badge className="w-fit" variant="secondary">{formatOfferCount(offers.length)}</Badge>
            <AppStoreButton
              appId={target.appId}
              appName={target.name}
              className="h-12 w-full text-base sm:h-7 sm:w-auto sm:text-[0.8rem]"
              country={storeCountry}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-12 w-full text-base sm:h-7 sm:w-auto sm:text-[0.8rem]"
                  disabled={refreshing}
                  onClick={onRefresh}
                  size="sm"
                  variant="outline"
                >
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
    <OfferCard
      activeOfferKey={activeOffer.key}
      baseCurrency={baseCurrency}
      offer={activeOffer}
      offerGroups={offerGroups}
      onOfferChange={setActiveOfferKey}
    />
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
      <SelectTrigger className="w-full text-base data-[size=default]:h-12 sm:text-sm sm:data-[size=default]:h-10">
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

function OfferCard({
  activeOfferKey,
  baseCurrency,
  offer,
  offerGroups,
  onOfferChange
}: {
  activeOfferKey: string;
  baseCurrency: string;
  offer: ProductComparison;
  offerGroups: Array<{ kind: string; offers: ProductComparison[] }>;
  onOfferChange: (key: string) => void;
}) {
  const cheapestPrice = findCheapestPrice(offer.prices);
  const highestPrice = findHighestPrice(offer.prices);
  const savingsPercent = formatSavingsPercent(offer.stats);

  return (
    <Card className="[--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
      <CardHeader className="gap-3 has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_minmax(16rem,26rem)]">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate">{offer.name}</span>
            <Badge variant="outline">{formatOfferKind(offer)}</Badge>
          </CardTitle>
          <CardDescription>Compare country / region prices for the selected plan.</CardDescription>
        </div>
        <CardAction className="col-start-1 row-span-1 row-start-auto w-full justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-full sm:justify-self-end">
          <OfferSelect
            activeOfferKey={activeOfferKey}
            baseCurrency={baseCurrency}
            offerGroups={offerGroups}
            onChange={onOfferChange}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)]">
          <div className="flex min-h-36 flex-col justify-between rounded-lg bg-primary p-4 text-primary-foreground sm:min-h-40">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ArrowDownIcon className="size-4" />
                <span>Lowest converted price</span>
              </div>
              {savingsPercent ? (
                <Badge className="bg-price-low text-price-low-foreground" variant="default">
                  Save {savingsPercent}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <div className="truncate text-3xl font-semibold tracking-normal">
                {formatMoney(offer.stats?.min, baseCurrency)}
              </div>
              <div className="flex flex-col gap-0.5 text-sm text-primary-foreground/80">
                <span>Cheapest market: {formatCountryLabel(cheapestPrice)}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
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
        <ScrollArea className="h-[520px] max-h-[72vh] rounded-lg border md:h-[460px] md:max-h-[65vh]">
          <MobilePriceList baseCurrency={baseCurrency} offer={offer} />
          <div className="hidden md:block">
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
                      <LocalPriceValue price={price} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(price.priceInBase, baseCurrency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MobilePriceList({ baseCurrency, offer }: { baseCurrency: string; offer: ProductComparison }) {
  return (
    <div className="flex flex-col divide-y md:hidden">
      {offer.prices.map((price, index) => (
        <div key={`${offer.key}:mobile:${price.country}`} className={cn("flex flex-col gap-3 p-3", index === 0 && "bg-muted/30")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Badge className="shrink-0" variant={index === 0 ? "default" : "secondary"}>
                #{index + 1}
              </Badge>
              <RegionFlag country={price.country} />
              <span className="min-w-0 truncate font-medium">{formatCountryLabel(price)}</span>
            </div>
            <div className="shrink-0 text-right font-semibold tracking-normal">
              {formatMoney(price.priceInBase, baseCurrency)}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="shrink-0 text-muted-foreground">Local price</span>
            <LocalPriceValue price={price} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LocalPriceValue({ price }: { price: CountryPrice }) {
  const { amount, marker } = splitLocalPrice(price.localPrice);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {marker ? (
        <Badge variant="outline" className="font-mono tracking-normal">
          {marker}
        </Badge>
      ) : null}
      <span className="font-medium tracking-normal">{amount}</span>
    </div>
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
      className="inline-flex h-6 min-w-7 shrink-0 items-center justify-center text-xl leading-none"
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
    <div className="flex min-h-24 flex-col justify-between rounded-lg border bg-muted/30 p-2 sm:min-h-32 sm:p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="truncate text-sm font-semibold tracking-normal sm:text-lg">{value}</div>
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

function getAppStoreUrl(appId: string, country?: string | null, appName?: string | null) {
  if (!/^\d+$/.test(appId)) {
    return null;
  }

  const appPath = formatAppStorePath(appId, appName);
  const storefront = country?.trim().toLowerCase();
  if (storefront && /^[a-z]{2}$/.test(storefront)) {
    return `https://apps.apple.com/${storefront}/app/${appPath}`;
  }

  return `https://apps.apple.com/app/${appPath}`;
}

function formatAppStorePath(appId: string, appName?: string | null) {
  const slug = formatAppStoreSlug(appName);
  return slug ? `${slug}/id${appId}` : `id${appId}`;
}

function formatAppStoreSlug(appName?: string | null) {
  const slug = appName
    ?.trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug ? encodeURIComponent(slug) : null;
}

function splitLocalPrice(localPrice: string | null | undefined) {
  const value = localPrice?.trim().replace(/\s+/g, " ");
  if (!value) {
    return { amount: "-", marker: null };
  }

  const leadingMarker = value.match(/^([^\p{N}+.,-]+)\s*(.+)$/u);
  if (leadingMarker) {
    return {
      amount: leadingMarker[2].trim(),
      marker: leadingMarker[1].trim()
    };
  }

  const trailingMarker = value.match(/^(.+?)\s*([^\p{N}+.,-]+)$/u);
  if (trailingMarker) {
    return {
      amount: trailingMarker[1].trim(),
      marker: trailingMarker[2].trim()
    };
  }

  return { amount: value, marker: null };
}

function formatSavingsPercent(stats: ProductComparison["stats"]) {
  const min = stats?.min;
  const max = stats?.max;
  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max <= 0 ||
    max <= min
  ) {
    return null;
  }

  return `${(((max - min) / max) * 100).toFixed(1)}%`;
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
