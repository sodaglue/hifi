//
//  DiskCacheEditor.cpp
//
//
//  Created by Clement on 3/4/15.
//  Copyright 2015 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#include <functional>

#include <QDebug>
#include <QDialog>
#include <QGridLayout>
#include <QPushButton>
#include <QLabel>
#include <QNetworkDiskCache>
#include <QMessageBox>

#include <NetworkAccessManager.h>

#include "DiskCacheEditor.h"
#include "OffscreenUi.h"

DiskCacheEditor::DiskCacheEditor(QWidget* parent) : QObject(parent) {
    
}

QWindow* DiskCacheEditor::windowHandle() {
    return (_dialog) ? _dialog->windowHandle() : nullptr;
}

void DiskCacheEditor::toggle() {
    qDebug() << "DiskCacheEditor::toggle()";
    if (!_dialog) {
        makeDialog();
    }
    
    if (!_dialog->isActiveWindow()) {
        _dialog->show();
        _dialog->raise();
        _dialog->activateWindow();
    } else {
        _dialog->close();
    }
}

void DiskCacheEditor::makeDialog() {
    _dialog = new QDialog(static_cast<QWidget*>(parent()));
    Q_CHECK_PTR(_dialog);
    _dialog->setAttribute(Qt::WA_DeleteOnClose);
    _dialog->setWindowTitle("Disk Cache Editor");
    
    QGridLayout* layout = new QGridLayout(_dialog);
    Q_CHECK_PTR(layout);
    _dialog->setLayout(layout);
    
    
    QLabel* path = new QLabel("Path : ", _dialog);
    Q_CHECK_PTR(path);
    path->setAlignment(Qt::AlignRight);
    layout->addWidget(path, 0, 0);
    
    QLabel* size = new QLabel("Current Size : ", _dialog);
    Q_CHECK_PTR(size);
    size->setAlignment(Qt::AlignRight);
    layout->addWidget(size, 1, 0);
    
    QLabel* maxSize = new QLabel("Max Size : ", _dialog);
    Q_CHECK_PTR(maxSize);
    maxSize->setAlignment(Qt::AlignRight);
    layout->addWidget(maxSize, 2, 0);
    
    
    _path = new QLabel(_dialog);
    Q_CHECK_PTR(_path);
    _path->setAlignment(Qt::AlignLeft);
    layout->addWidget(_path, 0, 1, 1, 3);
    
    _size = new QLabel(_dialog);
    Q_CHECK_PTR(_size);
    _size->setAlignment(Qt::AlignLeft);
    layout->addWidget(_size, 1, 1, 1, 3);
    
    _maxSize = new QLabel(_dialog);
    Q_CHECK_PTR(_maxSize);
    _maxSize->setAlignment(Qt::AlignLeft);
    layout->addWidget(_maxSize, 2, 1, 1, 3);
    
    refresh();
    
    
    QPushButton* refreshCacheButton = new QPushButton(_dialog);
    Q_CHECK_PTR(refreshCacheButton);
    refreshCacheButton->setText("Refresh");
    refreshCacheButton->setToolTip("Reload the cache stats.");
    connect(refreshCacheButton, SIGNAL(clicked()), SLOT(refresh()));
    layout->addWidget(refreshCacheButton, 3, 2);
    
    QPushButton* clearCacheButton = new QPushButton(_dialog);
    Q_CHECK_PTR(clearCacheButton);
    clearCacheButton->setText("Clear");
    clearCacheButton->setToolTip("Erases the entire content of the disk cache.");
    connect(clearCacheButton, SIGNAL(clicked()), SLOT(clear()));
    layout->addWidget(clearCacheButton, 3, 3);
}

void DiskCacheEditor::refresh() {
    static const std::function<QString(qint64)> stringify = [](qint64 number) {
        static const QStringList UNITS = QStringList() << "B" << "KB" << "MB" << "GB";
        static const qint64 CHUNK = 1024;
        QString unit;
        int i = 0;
        for (i = 0; i < 4; ++i) {
            if (number / CHUNK > 0) {
                number /= CHUNK;
            } else {
                break;
            }
        }
        return QString("%0 %1").arg(number).arg(UNITS[i]);
    };
    QNetworkDiskCache* cache = qobject_cast<QNetworkDiskCache*>(NetworkAccessManager::getInstance().cache());
    
    if (_path) {
        _path->setText(cache->cacheDirectory());
    }
    if (_size) {
        _size->setText(stringify(cache->cacheSize()));
    }
    if (_maxSize) {
        _maxSize->setText(stringify(cache->maximumCacheSize()));
    }
}

void DiskCacheEditor::clear() {
    QMessageBox::StandardButton buttonClicked =
                                    OffscreenUi::question(_dialog, "Clearing disk cache",
                                              "You are about to erase all the content of the disk cache, "
                                              "are you sure you want to do that?",
                                              QMessageBox::Ok | QMessageBox::Cancel);
    if (buttonClicked == QMessageBox::Ok) {
        if (auto cache = NetworkAccessManager::getInstance().cache()) {
            qDebug() << "DiskCacheEditor::clear(): Clearing disk cache.";
            cache->clear();
        }
    }
    refresh();
}
