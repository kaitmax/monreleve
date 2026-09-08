// web/lib/ui/react/Container/Container.tsx
//
// The three content widths, and no fourth. Ruling R64:
//
//   public   1200  FD1:15, FD11:15, FD13:17 - "content max width 1200"
//   narrow    720  FD1:41, :46, :67, :97, :103 - the calculator column
//   article   680  FD13:23 - the prose measure, ~70 characters per line
//
// THE PROP IS A UNION, WHICH IS THE WHOLE DESIGN. A `maxWidth: number` prop
// would make every caller a place where a new width could be invented, and the
// fourth one always arrives - a page that needs "just a bit wider" and gets a
// number nobody put in a brief. There is no escape hatch here on purpose:
// Container.types.ts asserts with @ts-expect-error that an arbitrary value
// does not compile, and that directive fails the build if the union is ever
// widened to `string`.
//
// A width that is genuinely missing is a ruling, not a prop. That is the
// trade: adding one costs a conversation, which is the point.
//
// IT EMITS A PLAIN DIV. A container is layout, so a landmark here would put an
// element in the accessibility tree for a visual decision and fight the page
// that already has one - FW9's protocol item 8 makes the h1 and the landmarks
// the page's job, and PublicShell must not emit an h1 either.
//
// The variant reaches the stylesheet as a DATA ATTRIBUTE rather than a class,
// so it is assertable from a test: CSS Module class names are hashed, and
// `data-width="article"` is the readable contract between this union and the
// three max-width rules.

import styles from './Container.module.scss';

/**
 * The three named widths. Not `string`, and not extendable by a caller -
 * see the module comment and Container.types.ts.
 */
export type ContainerWidth = 'public' | 'narrow' | 'article';

export interface ContainerProps {
  readonly width: ContainerWidth;
  readonly children: React.ReactNode;
}

export function Container({ width, children }: ContainerProps) {
  return (
    <div className={styles.root} data-width={width}>
      {children}
    </div>
  );
}
