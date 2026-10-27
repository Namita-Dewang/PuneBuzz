import cx from '../../utils/cx';

const PADDING = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

/**
 * Surface with a 1px border, rounded-2xl and a very soft shadow.
 * `interactive` adds the hover lift (use it when the whole card is a link,
 * e.g. `<Card as={Link} to=… interactive>`).
 */
export default function Card({ as: Component = 'div', interactive = false, padding = 'md', className = '', children, ...props }) {
  return (
    <Component
      className={cx(
        'rounded-2xl border border-line bg-surface shadow-soft',
        PADDING[padding],
        interactive &&
          'transition duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
