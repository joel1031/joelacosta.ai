import { collection, config, fields, singleton } from '@keystatic/core';

// Local-only CMS — served at /keystatic during `npm run dev` (see astro.config.mjs).
// Collections mirror the zod schemas in src/content.config.ts; entries save as .mdx,
// which the blog/projects glob patterns already match.

const postImage = {
	directory: 'src/assets/blog',
	publicPath: '../../assets/blog/',
};
const projectImage = {
	directory: 'src/assets/projects',
	publicPath: '../../assets/projects/',
};

export default config({
	storage: { kind: 'local' },
	ui: {
		brand: { name: 'joel acosta' },
	},
	singletons: {
		// Ordered photo list — drives both /look and the home hero slideshow.
		gallery: singleton({
			label: 'look · gallery',
			path: 'src/content/gallery',
			format: { data: 'json' },
			schema: {
				images: fields.array(
					fields.object({
						name: fields.text({ label: 'Name', validation: { isRequired: true } }),
						image: fields.image({
							label: 'Photo',
							directory: 'src/assets/gallery',
							publicPath: '/src/assets/gallery/',
							validation: { isRequired: true },
						}),
					}),
					{
						label: 'Photos (first is the opening hero slide)',
						itemLabel: (props) => props.fields.name.value || 'photo',
					},
				),
			},
		}),
	},
	collections: {
		posts: collection({
			label: 'read · posts',
			slugField: 'title',
			path: 'src/content/blog/*',
			format: { contentField: 'content' },
			entryLayout: 'content',
			columns: ['pubDate'],
			schema: {
				title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
				description: fields.text({
					label: 'Description',
					multiline: true,
					validation: { isRequired: true },
				}),
				pubDate: fields.date({
					label: 'Published',
					defaultValue: { kind: 'today' },
					validation: { isRequired: true },
				}),
				updatedDate: fields.date({ label: 'Updated' }),
				heroImage: fields.image({ label: 'Hero image', ...postImage }),
				content: fields.mdx({
					label: 'Content',
					options: { image: postImage },
				}),
			},
		}),
		projects: collection({
			label: 'lab · projects',
			slugField: 'title',
			path: 'src/content/projects/*',
			format: { contentField: 'content' },
			entryLayout: 'content',
			columns: ['pubDate'],
			schema: {
				title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
				description: fields.text({
					label: 'Description',
					multiline: true,
					validation: { isRequired: true },
				}),
				pubDate: fields.date({
					label: 'Published',
					defaultValue: { kind: 'today' },
					validation: { isRequired: true },
				}),
				updatedDate: fields.date({ label: 'Updated' }),
				thumbnail: fields.image({
					label: 'Thumbnail',
					validation: { isRequired: true },
					...projectImage,
				}),
				content: fields.mdx({
					label: 'Content',
					options: { image: projectImage },
				}),
			},
		}),
	},
});
