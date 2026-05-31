import type { Team } from "@/domain/types";

export function TeamName({
  team,
  align = "left",
  compact = false,
}: {
  readonly team: Team;
  readonly align?: "left" | "right";
  readonly compact?: boolean;
}) {
  return (
    <span
      className={`team-name team-name--${align} ${compact ? "is-compact" : ""}`}
    >
      <img
        alt=""
        height={18}
        loading="lazy"
        src={`https://flagcdn.com/${team.flag}.svg`}
        width={24}
      />
      <span>{team.name}</span>
      {team.host && <em>Host</em>}
      {team.debutant && <em>Debut</em>}
    </span>
  );
}
