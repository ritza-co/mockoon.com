import matter from 'gray-matter';
import { useRouter } from 'next/router';
import React, { ChangeEvent, useState } from 'react';
import { rsort as semverSort } from 'semver';
import ContactBanner from '../../components/contact-banner';
import Download from '../../components/download';
import Hero from '../../components/hero';
import Markdown from '../../components/markdown';
import Meta from '../../components/meta';
import Layout from '../../layout/layout';
import {
  DocsNavCategory,
  DocsNavData,
  DocsNavItem,
  DocsTopicData
} from '../../models/docs.model';
import { sortByOrder } from '../../utils/utils';
const latestVersion = require('../../package.json').version;

/**
 * Browse the ./content/docs/... folder and list all the topics.
 * Content files name must follow this pattern:
 * {version}/{category}/{topic}.md
 *
 * Category depth cannot be higher than 1.
 *
 */
export async function getStaticPaths() {
  const paths = ((files) => {
    const keys = files.keys();

    return keys.map((key) => {
      const pathParts = key.split('/');
      return {
        params: {
          slug: [
            // create slug from the path parts (version / path / file name (-ext))
            ...pathParts.slice(1).map((part, partIndex, parts) => {
              if (partIndex === parts.length - 1) {
                return part.split('.')[0];
              }
              return part;
            })
          ]
        }
      };
    });
  })(require.context('../../content/docs/', true, /\.md$/));

  return {
    paths,
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const slugVersion = params.slug[0];

  // get all documentation file list
  const docsData = ((files) => {
    const filePaths = files.keys();
    const fileContents: any[] = filePaths.map(files);
    const versions = new Set<string>();
    const topicList: {
      slug: string;
      data: DocsTopicData;
      categoryName: string;
    }[] = [];

    filePaths.forEach((topicPath, index) => {
      const pathParts = topicPath.split('/');
      const version = pathParts[1];

      versions.add(version);

      // only push topic from the current slug version in the list
      if (topicPath.includes(slugVersion)) {
        // we remove both /docs and version from the current slug
        const topicPath = pathParts.slice(2).map((part, partIndex, parts) => {
          if (partIndex === parts.length - 1) {
            return part.split('.')[0];
          }
          return part;
        });

        const fileContent = fileContents[index];
        const parsedContent = matter(fileContent.default);
        topicList.push({
          slug: `${slugVersion}/${topicPath.join('/')}`,
          data: parsedContent.data as DocsTopicData,
          categoryName: topicPath.length === 2 ? topicPath[0] : null
        });
      }
    });

    return {
      versions: Array.from(versions),
      list: topicList
    };
  })(require.context('../../content/docs', true, /\.md$/));

  const fileContent = await require(`../../content/docs/${params.slug.join(
    '/'
  )}.md`);
  const parsedContent = matter(fileContent.default);

  const navItems = docsData.list
    .reduce((navItems: DocsNavData, topic) => {
      const newItem: DocsNavItem = {
        type: 'topic',
        title: topic.data.title,
        order: topic.data.order || 1000,
        slug: `/docs/${topic.slug}`
      };

      if (topic.categoryName) {
        const existingCategoryIndex = navItems.findIndex(
          (navItem) =>
            navItem.type === 'category' &&
            navItem.categoryName === topic.categoryName
        );

        if (existingCategoryIndex !== -1) {
          (navItems[existingCategoryIndex] as DocsNavCategory).items.push(
            newItem
          );
          (navItems[existingCategoryIndex] as DocsNavCategory).items.sort(
            sortByOrder
          );
        } else {
          navItems.push({
            type: 'category',
            title: topic.categoryName.replace('-', ' '),
            categoryName: topic.categoryName,
            order: topic.data.order,
            items: [newItem]
          });
        }
      } else {
        navItems.push(newItem);
      }

      return navItems;
    }, [])
    .sort(sortByOrder);

  return {
    props: {
      slug: `docs/${params.slug.join('/')}`,
      navItems,
      versions: docsData.versions,
      topicData: parsedContent.data,
      topicBody: parsedContent.content
    }
  };
}

export default function Docs(props: {
  slug: string;
  navItems: DocsNavData;
  topicData: DocsTopicData;
  topicBody: string;
  versions: string[];
}) {
  const router = useRouter();
  let currentVersion = router.asPath.split('/')[2];
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);

  const sortedVersions = semverSort(
    props.versions.filter((version) => version !== 'latest')
  );
  sortedVersions.unshift('latest');
  const versionsMenu = sortedVersions.map((version: string) => {
    let label = version;
    if (version === 'latest') {
      label = `v${latestVersion} (${version})`;
    }

    if (version === 'v1.7.0') {
      label = `${version} (and older)`;
    }

    return { value: version, label };
  });

  const switchVersion = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersion(event.target.value);
    router.push(`/docs/${event.target.value}/about/`);
  };

  return (
    <Layout>
      <Meta
        title={props.topicData.meta.title}
        description={props.topicData.meta.description}
        ogType='article'
        url={`/${props.slug}`}
      />

      <Hero />

      <div className='section'>
        <div className='container'>
          <div className='columns'>
            <div className='column is-3'>
              <div className='content'>
                <h3>Documentation</h3>
                <div className='select'>
                  <select
                    aria-label='Versions menu'
                    value={selectedVersion}
                    onChange={switchVersion}
                  >
                    {versionsMenu.map((version, versionIndex) => (
                      <option
                        aria-label={`Version ${version.label}`}
                        key={`version${versionIndex}`}
                        value={version.value}
                      >
                        {version.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <aside className='menu'>
                <ul className='menu-list'>
                  {props.navItems.map((menuItem, menuItemIndex) => {
                    const itemsToBuild =
                      menuItem.type === 'category'
                        ? menuItem.items
                        : [menuItem];

                    const itemsHtml = itemsToBuild.map((item, itemIndex) => (
                      <li key={`link${itemIndex}`}>
                        <a
                          href={`${item.slug}/`}
                          className={
                            router.asPath.includes(item.slug) ? 'is-active' : ''
                          }
                        >
                          {item.title}
                        </a>
                      </li>
                    ));

                    return [
                      menuItem.type === 'category' && (
                        <p
                          className='menu-label'
                          key={`category${menuItemIndex}`}
                        >
                          {menuItem.title}
                        </p>
                      ),
                      itemsHtml
                    ];
                  })}
                </ul>
                <div style={{ marginTop: '25px' }}>
                  <Download />
                </div>
              </aside>
            </div>
            <div className='column is-9'>
              <div className='content'>
                <Markdown body={props.topicBody} version={currentVersion} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <ContactBanner />
    </Layout>
  );
}
