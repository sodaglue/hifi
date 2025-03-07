//
//  ShapePipeline.cpp
//  render/src/render
//
//  Created by Zach Pomerantz on 12/31/15.
//  Copyright 2015 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#include "DependencyManager.h"

#include "ShapePipeline.h"

#include <PerfStat.h>

using namespace render;

ShapeKey::Filter::Builder::Builder() {
    _mask.set(OWN_PIPELINE);
    _mask.set(INVALID);
}

void ShapePlumber::addPipelineHelper(const Filter& filter, ShapeKey key, int bit, const PipelinePointer& pipeline) {
    // Iterate over all keys
    if (bit < (int)ShapeKey::FlagBit::NUM_FLAGS) {
        addPipelineHelper(filter, key, bit + 1, pipeline);
        if (!filter._mask[bit]) {
            // Toggle bits set as insignificant in filter._mask 
            key._flags.flip(bit);
            addPipelineHelper(filter, key, bit + 1, pipeline);
        }
    } else {
        // Add the brand new pipeline and cache its location in the lib
        _pipelineMap.insert(PipelineMap::value_type(key, pipeline));
    }
}

void ShapePlumber::addPipeline(const Key& key, const gpu::ShaderPointer& program, const gpu::StatePointer& state,
        BatchSetter batchSetter) {
    addPipeline(Filter{key}, program, state, batchSetter);
}

void ShapePlumber::addPipeline(const Filter& filter, const gpu::ShaderPointer& program, const gpu::StatePointer& state,
        BatchSetter batchSetter) {
    gpu::Shader::BindingSet slotBindings;
    slotBindings.insert(gpu::Shader::Binding(std::string("skinClusterBuffer"), Slot::SKINNING_GPU));
    slotBindings.insert(gpu::Shader::Binding(std::string("materialBuffer"), Slot::MATERIAL_GPU));
    slotBindings.insert(gpu::Shader::Binding(std::string("diffuseMap"), Slot::DIFFUSE_MAP));
    slotBindings.insert(gpu::Shader::Binding(std::string("normalMap"), Slot::NORMAL_MAP));
    slotBindings.insert(gpu::Shader::Binding(std::string("specularMap"), Slot::SPECULAR_MAP));
    slotBindings.insert(gpu::Shader::Binding(std::string("emissiveMap"), Slot::LIGHTMAP_MAP));
    slotBindings.insert(gpu::Shader::Binding(std::string("lightBuffer"), Slot::LIGHT_BUFFER));
    slotBindings.insert(gpu::Shader::Binding(std::string("normalFittingMap"), Slot::NORMAL_FITTING_MAP));

    gpu::Shader::makeProgram(*program, slotBindings);

    auto locations = std::make_shared<Locations>();
    locations->texcoordMatrices = program->getUniforms().findLocation("texcoordMatrices");
    locations->emissiveParams = program->getUniforms().findLocation("emissiveParams");
    locations->normalFittingMapUnit = program->getTextures().findLocation("normalFittingMap");
    locations->diffuseTextureUnit = program->getTextures().findLocation("diffuseMap");
    locations->normalTextureUnit = program->getTextures().findLocation("normalMap");
    locations->specularTextureUnit = program->getTextures().findLocation("specularMap");
    locations->emissiveTextureUnit = program->getTextures().findLocation("emissiveMap");
    locations->skinClusterBufferUnit = program->getBuffers().findLocation("skinClusterBuffer");
    locations->materialBufferUnit = program->getBuffers().findLocation("materialBuffer");
    locations->lightBufferUnit = program->getBuffers().findLocation("lightBuffer");

    ShapeKey key{filter._flags};
    auto gpuPipeline = gpu::Pipeline::create(program, state);
    auto shapePipeline = std::make_shared<Pipeline>(gpuPipeline, locations, batchSetter);
    addPipelineHelper(filter, key, 0, shapePipeline);
}

const ShapePipelinePointer ShapePlumber::pickPipeline(RenderArgs* args, const Key& key) const {
    assert(!_pipelineMap.empty());
    assert(args);
    assert(args->_batch);

    PerformanceTimer perfTimer("ShapePlumber::pickPipeline");

    const auto& pipelineIterator = _pipelineMap.find(key);
    if (pipelineIterator == _pipelineMap.end()) {
        qDebug() << "Couldn't find a pipeline from ShapeKey ?" << key;
        return PipelinePointer(nullptr);
    }

    PipelinePointer shapePipeline(pipelineIterator->second);
    auto& batch = args->_batch;

    // Run the pipeline's BatchSetter on the passed in batch
    if (shapePipeline->batchSetter) {
        shapePipeline->batchSetter(*shapePipeline, *batch);
    }

    // Setup the one pipeline (to rule them all)
    batch->setPipeline(shapePipeline->pipeline);

    return shapePipeline;
}
