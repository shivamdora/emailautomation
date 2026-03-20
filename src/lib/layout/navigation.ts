export type ShellNavigationChildItem = {
  href: string;
  label: string;
};

export type ShellNavigationItem = {
  href: string;
  label: string;
  children?: ShellNavigationChildItem[];
};

export function isNavigationItemActive(item: ShellNavigationItem, pathname: string) {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return (item.children ?? []).some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
  );
}

export function getDefaultOpenNavigationKeys(items: ShellNavigationItem[], pathname: string) {
  return items
    .filter((item) => item.children?.length && isNavigationItemActive(item, pathname))
    .map((item) => item.href);
}
