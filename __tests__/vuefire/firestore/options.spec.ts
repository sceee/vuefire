import firebase from 'firebase'
import { firestorePlugin } from '../../../src'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { generateRandomID, initFirebase } from '../../src'

const component = defineComponent({ template: 'no' })

beforeAll(() => {
  initFirebase()
})

describe('Firestore: plugin options', () => {
  it('allows customizing $rtdbBind', () => {
    const wrapper = mount(component, {
      global: {
        plugins: [
          [
            firestorePlugin,
            {
              bindName: '$myBind',
              unbindName: '$myUnbind',
            },
          ],
        ],
      },
    })
    expect(typeof (wrapper.vm as any).$myBind).toBe('function')
    expect(typeof (wrapper.vm as any).$myUnbind).toBe('function')
  })

  it('calls custom serialize function with collection', async () => {
    const pluginOptions = {
      serialize: jest.fn(() => ({ foo: 'bar' })),
    }
    const wrapper = mount(
      {
        template: 'no',
        data: () => ({ items: [] }),
      },
      {
        global: {
          plugins: [[firestorePlugin, pluginOptions]],
        },
      }
    )

    const items = firebase.firestore().collection(generateRandomID())
    await items.add({})

    await wrapper.vm.$bind('items', items)

    expect(pluginOptions.serialize).toHaveBeenCalledTimes(1)
    expect(pluginOptions.serialize).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Function) })
    )
    expect(wrapper.vm.items).toEqual([{ foo: 'bar' }])
  })

  it('can be overridden by local option', async () => {
    const pluginOptions = {
      serialize: jest.fn(() => ({ foo: 'bar' })),
    }
    const wrapper = mount(
      {
        template: 'no',
        data: () => ({ items: [] }),
      },
      {
        global: {
          plugins: [[firestorePlugin, pluginOptions]],
        },
      }
    )

    const items = firebase.firestore().collection(generateRandomID())
    await items.add({})

    const spy = jest.fn(() => ({ bar: 'bar' }))

    await wrapper.vm.$bind('items', items, { serialize: spy })

    expect(pluginOptions.serialize).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Function) })
    )
    expect(wrapper.vm.items).toEqual([{ bar: 'bar' }])
  })
})
