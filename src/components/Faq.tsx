import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { TypedObject } from "@portabletext/types";

// Answers render in React rather than through RichText.astro, which cannot be
// nested inside an island. That drops EmDash's htmlBlock sanitiser, so raw HTML
// blocks are deliberately not rendered here.
const components: PortableTextComponents = {
	marks: {
		link: ({ value, children }) => <a href={value?.href}>{children}</a>,
	},
	unknownType: () => null,
};

export type FaqItem = {
	id: string;
	question: string;
	answer: TypedObject[];
};

export function Faq({ items }: { items: FaqItem[] }) {
	if (items.length === 0) return null;
	return (
		<Accordion allowsMultipleExpanded defaultExpandedKeys={[items[0].id]}>
			{items.map((item) => (
				<AccordionItem key={item.id} id={item.id}>
					<AccordionTrigger className="text-base">
						{item.question}
					</AccordionTrigger>
					<AccordionContent>
						<div className="prose border-l-2 border-primary pl-4 dark:prose-invert">
							<PortableText value={item.answer} components={components} />
						</div>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
