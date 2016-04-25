import React, { Component } from 'react';
import { connect as reduxConnect } from 'react-redux';
import invariant from 'invariant';

import ContentTypes from './constants/ContentTypes';
import { createRequest } from './actionCreators';
import { fetchResource } from './sagas';

import {
  customContentTypes,
  makeContentTypeOptions,
  deriveContentType
} from './contentTypes';

/**
 * Repress connect.
 * TODO write better doc
 * @param {String} [contentType] The content type for which the WP-API request will be made.
 * @param {String} [routeParamsPropName] From which object on props will the WP-API route parameters be derived?
 * @param {Boolean} [useEmbedRequestQuery] Override global default for using `_embed` query parameter in WP-API request.
 * @returns {Function}
 */
export default function repressConnect ({
  contentType = null,
  routeParamsPropName = 'params',
  useEmbedRequestQuery = true
} = {}) {
  return target => {
    invariant(
      !target.__repress,
      'The component "%s" is already wrapped by Repress.',
      target.name
    );

    contentType = contentType ||
      customContentTypes[contentType] ||
      deriveContentType(target.name);

    invariant(
      contentType,
      'Could not derive content type from class name "%s". ' +
      'Pass built-ins using Repress.ContentTypes. For example, ContentTypes.POST. ' +
      'Custom Content Types should be registered with Repress#registerCustomContentType.',
      target.name
    );

    const isCustomContentType = !!customContentTypes[contentType];

    const contentTypeOptions = isCustomContentType
      ? customContentTypes[contentType]
      : makeContentTypeOptions(contentType);

    function mapStateToProps (state, ownProps) {
      const params = ownProps[routeParamsPropName];
      const collection = state.$$repress.entities[contentTypeOptions.namePlural];
      const value = collection ? collection[params.id] : null;
      return { [contentTypeOptions.name]: value };
    }

    class RepressComponentWrapper extends Component {
      componentWillMount () {
        // TODO allow some method of forcing re-fetch, or should this be done manually be invalidate action?
        const params = this.props[routeParamsPropName];
        const collection = this.props[contentTypeOptions.name];
        if (!collection || !collection[params.id]) {
          this.props.dispatch(this.createRequestAction());
        }
      }

      createRequestAction () {
        const contentTypeNamespace = isCustomContentType
          ? ContentTypes.CUSTOM_CONTENT_TYPE
          : contentType;

        return createRequest(contentTypeNamespace, {
          params: this.props[routeParamsPropName],
          contentType,
          useEmbedRequestQuery
        });
      }

      render () {
        return <target {...this.props} />;
      }
    }

    RepressComponentWrapper.__repress = true;

    /**
     * Fetch the content data according to the configuration in `store`.
     * @param {Object} store The redux store
     */
    RepressComponentWrapper.fetchData = store => [
      [fetchResource, { contentType, useEmbedRequestQuery }]
    ];

    return reduxConnect(mapStateToProps)(RepressComponentWrapper);
  };
};
