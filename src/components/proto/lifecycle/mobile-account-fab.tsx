export function MobileAccountFab({
  user,
  onPress,
  label,
}: {
  user: { name: string; initials: string };
  onPress: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      title={label}
      className="fixed right-4 bottom-4 z-40 flex size-11 items-center justify-center rounded-full bg-kumo-base shadow-lg ring ring-kumo-line transition-transform duration-150 ease-out active:scale-[0.96] md:hidden"
    >
      <span className="grid size-9 place-items-center rounded-full bg-kumo-fill text-sm font-semibold text-kumo-default">
        {user.initials}
      </span>
    </button>
  );
}
