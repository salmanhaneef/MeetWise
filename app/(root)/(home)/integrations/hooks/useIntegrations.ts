import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export interface Integration {
  platform: "google-calendar" | "trello" | "jira" | "asana" | "slack";
  name: string;
  description: string;
  connected: boolean;
  boardName?: string;
  projectName?: string;
  channelName?: string;
  logo: string;
}

interface IntegrationStatus {
  platform: "google-calendar" | "trello" | "jira" | "asana" | "slack";
  connected: boolean;
  boardName?: string;
  projectName?: string;
  channelName?: string;
}

interface SetupConfig {
  action?: string;
  boardId?: string;
  projectId?: string;
  channelId?: string;
  channelName?: string;
  [key: string]: string | undefined;
}

export function useIntegrations() {
  const { userId } = useAuth();

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      platform: "slack",
      name: "Slack",
      description: "Post meeting summaries to your Slack channels",
      connected: false,
      channelName: undefined,
      logo: "/slack.png",
    },
    {
      platform: "trello",
      name: "Trello",
      description: "Add action items to your Trello boards",
      connected: false,
      logo: "/trello.png",
    },
    {
      platform: "jira",
      name: "Jira",
      description: "Create tickets for development tasks and more",
      connected: false,
      logo: "/jira.png",
    },
    {
      platform: "asana",
      name: "Asana",
      description: "Sync tasks with your team projects",
      connected: false,
      logo: "/asana.png",
    },
    {
      platform: "google-calendar",
      name: "Google Calendar",
      description: "Auto-Sync meetings",
      connected: false,
      logo: "/gcal.png",
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchIntegrations();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const setup = urlParams.get("setup");
    const slackStatus = urlParams.get("slack");

    if (setup && ["trello", "jira", "asana", "slack"].includes(setup)) {
      setSetupMode(setup);
      // ✅ Fetch setup data for ALL platforms including slack
      fetchSetupData(setup);
    }

    // Handle Slack OAuth return
    if (slackStatus === "installed" || slackStatus === "success") {
      fetchIntegrations();
      window.history.replaceState({}, "", "/integrations");
    }
  }, [userId]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/integrations/status");
      const data = await response.json();

      if (data.error) {
        setLoading(false);
        return;
      }

      let calendarData = { connected: false };
      try {
        const calendarResponse = await fetch("/api/user/calendar-status");
        if (calendarResponse.ok) {
          calendarData = await calendarResponse.json();
        }
      } catch {
        // non-critical, ignore
      }

      setIntegrations((prev) =>
        prev.map((integration) => {
          if (integration.platform === "google-calendar") {
            return {
              ...integration,
              connected: calendarData.connected || false,
            };
          }

          const status = data.find(
            (d: IntegrationStatus) => d.platform === integration.platform,
          );

          return {
            ...integration,
            connected: status?.connected || false,
            boardName: status?.boardName,
            projectName: status?.projectName,
            channelName: status?.channelName,
          };
        }),
      );
    } catch (error) {
      console.error("[useIntegrations] Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSetupData = async (platform: string) => {
    try {
      const response = await fetch(`/api/integrations/${platform}/setup`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          `[useIntegrations] Setup data fetch failed for ${platform}:`,
          errorData,
        );
        return;
      }

      const data = await response.json();
      console.log(`[useIntegrations] Setup data for ${platform}:`, data);
      setSetupData(data);
    } catch (error) {
      console.error(
        `[useIntegrations] Error fetching ${platform} setup data:`,
        error,
      );
    }
  };

  const handleConnect = (platform: string) => {
    if (platform === "slack") {
      window.location.href = "/api/slack/install?return=integrations";
    } else if (platform === "google-calendar") {
      window.location.href = "/api/auth/google/direct-connect";
    } else {
      window.location.href = `/api/integrations/${platform}/auth`;
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      if (platform === "google-calendar") {
        await fetch("/api/auth/google/disconnect", { method: "POST" });
      } else if (platform === "slack") {
        const response = await fetch("/api/integrations/slack/disconnect", {
          method: "POST",
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Disconnect failed");
        }
      } else {
        await fetch(`/api/integrations/${platform}/disconnect`, {
          method: "POST",
        });
      }

      fetchIntegrations();
    } catch (error) {
      console.error("[useIntegrations] Error disconnecting:", error);
      alert(`Failed to disconnect ${platform}: ${error}`);
    }
  };

  const handleSetupSubmit = async (platform: string, config: SetupConfig) => {
    setSetupLoading(true);

    try {
      // ✅ Slack channel save - direct POST with channelId/channelName only
      if (platform === "slack") {
        if (!config.channelId) {
          alert("Please select a channel");
          setSetupLoading(false);
          return;
        }

        const response = await fetch("/api/integrations/slack/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: config.channelId,
            channelName: config.channelName,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setSetupMode(null);
          setSetupData(null);
          fetchIntegrations();
          window.history.replaceState({}, "", "/integrations");
        } else {
          alert(
            `Failed to save Slack channel: ${data.error || "Unknown error"}`,
          );
        }
        return;
      }

      // All other platforms
      const bodyData = {
        action: config.action || "save",
        ...config,
      };

      const response = await fetch(`/api/integrations/${platform}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const responseData = await response.json();

      if (response.ok) {
        setSetupMode(null);
        setSetupData(null);
        fetchIntegrations();
        window.history.replaceState({}, "", "/integrations");
      } else {
        alert(`Setup failed: ${responseData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("[useIntegrations] Error saving setup:", error);
      alert(`Setup error: ${error}`);
    } finally {
      setSetupLoading(false);
    }
  };

  return {
    integrations,
    loading,
    setupMode,
    setSetupMode,
    setupData,
    setSetupData,
    setupLoading,
    setSetupLoading,
    fetchIntegrations,
    fetchSetupData,
    handleConnect,
    handleDisconnect,
    handleSetupSubmit,
  };
}
